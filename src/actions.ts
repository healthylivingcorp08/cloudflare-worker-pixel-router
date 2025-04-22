import type { KVNamespace, ExecutionContext, Request as CfRequest } from '@cloudflare/workers-types';
// Import DataSources specifically from the parameters utility
import { populateParameters, type DataSources as ParameterDataSources } from './utils/parameters';
import type { Env, PixelState } from './types';
// import { logError } from './logger'; // Assuming logger exists - Replaced with console.error

// --- Types specific to Action Triggering ---

interface ActionDefinitionBase {
  type: 'server-side' | 'client-side';
  provider: string;
}

interface ServerSideActionDefinition extends ActionDefinitionBase {
  type: 'server-side';
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'; // Add other methods if needed
  headers?: Record<string, string>;
  body_template?: Record<string, any> | string; // Can be JSON object or string template
}

interface ClientSideActionDefinition extends ActionDefinitionBase {
  type: 'client-side';
  script_template: string;
}

type ActionDefinition = ServerSideActionDefinition | ClientSideActionDefinition;

interface TriggerActionsResult {
  clientSideActions: string[];
}

// --- Helper Function ---

async function executeServerSideAction(
  action: ServerSideActionDefinition,
  populatedUrl: string,
  populatedHeaders: Record<string, string> | undefined,
  populatedBody: string | undefined,
  internal_txn_id: string,
  actionKey: string
): Promise<void> {
  try {
    const requestOptions: RequestInit = {
      method: action.method,
      headers: populatedHeaders,
    };
    if (populatedBody && (action.method === 'POST' || action.method === 'PUT')) {
      requestOptions.body = populatedBody;
    }

    const response = await fetch(populatedUrl, requestOptions);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Server-side action failed', { // Replaced logError
        internal_txn_id,
        actionKey,
        status: response.status,
        statusText: response.statusText,
        url: populatedUrl,
        errorBody: errorBody.substring(0, 500), // Limit error body size
      });
    } else {
      console.log(`Server-side action success: ${actionKey} for ${internal_txn_id}`);
    }
  } catch (error: any) {
    console.error('Error executing server-side action', { // Replaced logError
      internal_txn_id,
      actionKey,
      url: populatedUrl,
      errorMessage: error.message,
      stack: error.stack,
    });
  }
}

// --- Main Trigger Functions ---

/**
 * Triggers initial checkout actions (pixels, postbacks) after successful payment confirmation.
 * Handles idempotency and payout rules.
 */
export async function triggerInitialActions(
  internal_txn_id: string,
  confirmationData: any, // Data from successful Sticky.io NewOrder or order_view
  env: Env,
  context: ExecutionContext,
  request: CfRequest // The original incoming request to the worker endpoint
): Promise<TriggerActionsResult> {
  const stateKey = `txn_${internal_txn_id}`;
  const clientSideActions: string[] = [];
  const serverSidePromises: Promise<void>[] = [];

  try {
    const stateString = await env.PIXEL_STATE.get(stateKey);
    if (!stateString) {
      console.error('triggerInitialActions: State not found for txn', { internal_txn_id }); // Replaced logError
      return { clientSideActions: [] };
    }
    const state: PixelState = JSON.parse(stateString);

    // 1. Idempotency Check
    if (state.processed_Initial === true) {
      console.log(`triggerInitialActions: Already processed for ${internal_txn_id}`);
      return { clientSideActions: [] };
    }

    // 2. Update KV State (Mark as processed) - Do this early
    const updatedState: Partial<PixelState> = {
      processed_Initial: true,
      status: 'success', // Mark overall status as success on initial processing
      timestamp_processed_Initial: new Date().toISOString(),
    };
    // Use waitUntil to ensure KV write happens even if function returns early
    context.waitUntil(
      env.PIXEL_STATE.put(stateKey, JSON.stringify({ ...state, ...updatedState }))
        .catch(err => console.error('triggerInitialActions: Failed to update KV state', { internal_txn_id, error: err.message })) // Replaced logError
    );

    // 3. Fetch Payout Rules
    const payoutStepsStr = await env.PIXEL_CONFIG.get('payout_steps') ?? "1";
    const payoutSteps = parseInt(payoutStepsStr, 10);

    // 4. Check Payout Step
    if (isNaN(payoutSteps) || payoutSteps < 1) {
      console.log(`triggerInitialActions: Payout step (${payoutStepsStr}) prevents initial actions for ${internal_txn_id}`);
      return { clientSideActions: [] };
    }

    // 5. Fetch Action Keys & Definitions
    const actionKeysStr = await env.PIXEL_CONFIG.get('checkoutNormalActions'); // Assuming normal actions for now
    if (!actionKeysStr) {
      console.log(`triggerInitialActions: No checkoutNormalActions configured for ${internal_txn_id}`);
      return { clientSideActions: [] };
    }

    const actionKeys: string[] = JSON.parse(actionKeysStr);
    const actionDefinitions: { key: string; definition: ActionDefinition | null }[] = await Promise.all(
      actionKeys.map(async (key) => {
        const definitionStr = await env.PIXEL_CONFIG.get(`action:${key}`);
        return { key, definition: definitionStr ? JSON.parse(definitionStr) : null };
      })
    );

    // 6. Parameterize & Execute/Collect Actions
    // Construct dataSources and cast to the type expected by populateParameters
    const dataSources: ParameterDataSources = { state, confirmationData, request, env };
    // const isScrub = state.scrubDecision.isScrub; // isScrub is now handled within populateParameters/resolveParameterValue

    for (const { key: actionKey, definition } of actionDefinitions) {
      if (!definition) {
        console.error('triggerInitialActions: Action definition not found', { internal_txn_id, actionKey }); // Replaced logError
        continue;
      }

      try {
        if (definition.type === 'server-side') {
          // Await populateParameters, cast result where necessary
          const populatedUrlResult = await populateParameters(definition.url, dataSources);
          const populatedUrl = typeof populatedUrlResult === 'string' ? populatedUrlResult : JSON.stringify(populatedUrlResult); // Ensure string

          const populatedHeadersResult = definition.headers
            ? await populateParameters(definition.headers, dataSources)
            : undefined;
          // Ensure populatedHeaders is Record<string, string> | undefined
          const populatedHeaders = typeof populatedHeadersResult === 'object' && populatedHeadersResult !== null
            ? populatedHeadersResult as Record<string, string>
            : undefined;

          let populatedBody: string | undefined = undefined;
          if (definition.body_template) {
             if (typeof definition.body_template === 'object') {
                 const populatedBodyObj = await populateParameters(definition.body_template, dataSources);
                 populatedBody = JSON.stringify(populatedBodyObj);
             } else { // string template
                 const populatedBodyResult = await populateParameters(definition.body_template, dataSources);
                 // Ensure populatedBody is string | undefined
                 populatedBody = typeof populatedBodyResult === 'string' ? populatedBodyResult : undefined;
             }
          }

          // Add promise to array for async execution
          serverSidePromises.push(
            executeServerSideAction(definition, populatedUrl, populatedHeaders, populatedBody, internal_txn_id, actionKey)
          );

        } else if (definition.type === 'client-side') {
          const populatedScriptResult = await populateParameters(definition.script_template, dataSources);
           // Ensure populatedScript is string before pushing
          if (typeof populatedScriptResult === 'string') {
            clientSideActions.push(populatedScriptResult);
          } else {
             console.error('triggerInitialActions: Client-side script population did not return a string', { internal_txn_id, actionKey });
          }
        }
      } catch (paramError: any) {
         console.error('triggerInitialActions: Parameter population error', {
             internal_txn_id,
             actionKey,
             errorMessage: paramError.message,
         });
      }
    }

    // 7. Execute Server-Side Actions Asynchronously
    if (serverSidePromises.length > 0) {
      context.waitUntil(Promise.allSettled(serverSidePromises));
    }

    console.log(`triggerInitialActions: Completed for ${internal_txn_id}. Returning ${clientSideActions.length} client actions.`);
    return { clientSideActions };

  } catch (error: any) {
    console.error('triggerInitialActions: Unhandled error', { // Replaced logError
      internal_txn_id,
      errorMessage: error.message,
      stack: error.stack,
    });
    return { clientSideActions: [] }; // Return empty on error
  }
}

/**
 * Triggers upsell actions (pixels, postbacks) after successful upsell payment confirmation.
 * Handles idempotency based on the specific upsell step.
 */
export async function triggerUpsellActions(
  internal_txn_id: string,
  upsellStepNum: number, // e.g., 1, 2
  confirmationData: any, // Data from successful Sticky.io new_upsell
  env: Env,
  context: ExecutionContext,
  request: CfRequest // The original incoming request to the worker endpoint
): Promise<TriggerActionsResult> {
  const stateKey = `txn_${internal_txn_id}`;
  const clientSideActions: string[] = [];
  const serverSidePromises: Promise<void>[] = [];
  const processedFlagKey = `processed_Upsell_${upsellStepNum}` as keyof PixelState; // e.g., processed_Upsell_1
  const timestampFlagKey = `timestamp_processed_Upsell_${upsellStepNum}` as keyof PixelState; // e.g., timestamp_processed_Upsell_1
  const actionListKey = `upsell${upsellStepNum}NormalActions`; // e.g., upsell1NormalActions

  try {
    const stateString = await env.PIXEL_STATE.get(stateKey);
    if (!stateString) {
      console.error('triggerUpsellActions: State not found for txn', { internal_txn_id, upsellStepNum }); // Replaced logError
      return { clientSideActions: [] };
    }
    const state: PixelState = JSON.parse(stateString);

    // 1. Idempotency Check
    if (state[processedFlagKey] === true) {
      console.log(`triggerUpsellActions: Step ${upsellStepNum} already processed for ${internal_txn_id}`);
      return { clientSideActions: [] };
    }

    // 2. Update KV State (Mark step as processed) - Do this early
    const updatedState: Partial<PixelState> = {
      [processedFlagKey]: true,
      [timestampFlagKey]: new Date().toISOString(),
    };
     // Use waitUntil to ensure KV write happens even if function returns early
    context.waitUntil(
      env.PIXEL_STATE.put(stateKey, JSON.stringify({ ...state, ...updatedState }))
        .catch(err => console.error('triggerUpsellActions: Failed to update KV state', { internal_txn_id, upsellStepNum, error: err.message })) // Replaced logError
    );

    // 3. Fetch Action Keys & Definitions
    const actionKeysStr = await env.PIXEL_CONFIG.get(actionListKey); // Assuming normal actions for now
    if (!actionKeysStr) {
      console.log(`triggerUpsellActions: No ${actionListKey} configured for ${internal_txn_id}`);
      return { clientSideActions: [] };
    }

    const actionKeys: string[] = JSON.parse(actionKeysStr);
    const actionDefinitions: { key: string; definition: ActionDefinition | null }[] = await Promise.all(
      actionKeys.map(async (key) => {
        const definitionStr = await env.PIXEL_CONFIG.get(`action:${key}`);
        return { key, definition: definitionStr ? JSON.parse(definitionStr) : null };
      })
    );

    // 4. Parameterize & Execute/Collect Actions
    // Construct dataSources and cast to the type expected by populateParameters
    const dataSources: ParameterDataSources = { state, confirmationData, request, env };
    // const isScrub = state.scrubDecision.isScrub; // isScrub is now handled within populateParameters/resolveParameterValue

    for (const { key: actionKey, definition } of actionDefinitions) {
      if (!definition) {
        console.error('triggerUpsellActions: Action definition not found', { internal_txn_id, upsellStepNum, actionKey }); // Replaced logError
        continue;
      }

       try {
          if (definition.type === 'server-side') {
            // Await populateParameters, cast result where necessary
            const populatedUrlResult = await populateParameters(definition.url, dataSources);
            const populatedUrl = typeof populatedUrlResult === 'string' ? populatedUrlResult : JSON.stringify(populatedUrlResult); // Ensure string

            const populatedHeadersResult = definition.headers
              ? await populateParameters(definition.headers, dataSources)
              : undefined;
            // Ensure populatedHeaders is Record<string, string> | undefined
            const populatedHeaders = typeof populatedHeadersResult === 'object' && populatedHeadersResult !== null
              ? populatedHeadersResult as Record<string, string>
              : undefined;

            let populatedBody: string | undefined = undefined;
            if (definition.body_template) {
               if (typeof definition.body_template === 'object') {
                   const populatedBodyObj = await populateParameters(definition.body_template, dataSources);
                   populatedBody = JSON.stringify(populatedBodyObj);
               } else { // string template
                   const populatedBodyResult = await populateParameters(definition.body_template, dataSources);
                   // Ensure populatedBody is string | undefined
                   populatedBody = typeof populatedBodyResult === 'string' ? populatedBodyResult : undefined;
               }
            }

            // Add promise to array for async execution
            serverSidePromises.push(
              executeServerSideAction(definition, populatedUrl, populatedHeaders, populatedBody, internal_txn_id, actionKey)
            );

          } else if (definition.type === 'client-side') {
            const populatedScriptResult = await populateParameters(definition.script_template, dataSources);
            // Ensure populatedScript is string before pushing
            if (typeof populatedScriptResult === 'string') {
              clientSideActions.push(populatedScriptResult);
            } else {
               console.error('triggerUpsellActions: Client-side script population did not return a string', { internal_txn_id, upsellStepNum, actionKey });
            }
          }
       } catch (paramError: any) {
           console.error('triggerUpsellActions: Parameter population error', {
               internal_txn_id,
               upsellStepNum,
               actionKey,
               errorMessage: paramError.message,
           });
       }
    }

    // 5. Execute Server-Side Actions Asynchronously
    if (serverSidePromises.length > 0) {
      context.waitUntil(Promise.allSettled(serverSidePromises));
    }

    console.log(`triggerUpsellActions: Completed for step ${upsellStepNum} on ${internal_txn_id}. Returning ${clientSideActions.length} client actions.`);
    return { clientSideActions };

  } catch (error: any) {
    console.error('triggerUpsellActions: Unhandled error', { // Replaced logError
      internal_txn_id,
      upsellStepNum,
      errorMessage: error.message,
      stack: error.stack,
    });
    return { clientSideActions: [] }; // Return empty on error
  }
}