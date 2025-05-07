import type { KVNamespace, ExecutionContext, Request as CfRequest } from '@cloudflare/workers-types';
// Import DataSources specifically from the parameters utility
import { populateParameters, type DataSources as ParameterDataSources } from './utils/parameters';
import type { Env, PixelState } from './types';
import { getCache, setCache } from './utils/cache';
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

// --- Helper to get Action Keys based ONLY on affid and scrub status ---
// If affid is missing or the specific key isn't found, NO actions are returned.

async function getActionKeys(
  siteId: string,
  event: string, // e.g., 'checkout', 'upsell1', 'landing_page'
  isScrub: boolean,
  request: CfRequest,
  env: Env
): Promise<string[]> {
  const url = new URL(request.url);
  const affid = url.searchParams.get('affid'); // Case-sensitive 'affid'

  if (!affid || affid.trim() === '') {
    console.log(`getActionKeys: Required 'affid' parameter missing or empty in URL. No actions will be fired for site ${siteId}, event ${event}.`);
    return []; // Return empty list if affid is missing or empty
  }

  // Convert the affid from the URL parameter to lowercase for consistent lookup
  const affidLower = affid.trim().toLowerCase();
  const scrubStatusString = isScrub ? 'Scrub' : 'Normal';

  // Define cache key
  const cacheKey = `actionKeys_${siteId}_${event}_${affidLower}_${scrubStatusString}`;
  const cachedKeys = getCache<string[]>(cacheKey);

  if (cachedKeys) {
    console.log(`Cache hit for action keys: ${cacheKey}`);
    return cachedKeys;
  }

  console.log(`Cache miss for action keys: ${cacheKey}. Fetching from KV.`);

  // Construct the specific KV key name using the lowercase affid
  // Example: esther_checkout_affid_testaff_NormalActions
  const actionListKey = `${siteId}_${event}_affid_${affidLower}_${scrubStatusString}Actions`;

  console.log(`getActionKeys: Attempting to fetch affiliate-specific action list key (using lowercase affid): ${actionListKey}`);

  if (!env.PIXEL_CONFIG) {
    console.warn(`[getActionKeys] PIXEL_CONFIG KV namespace not available. Cannot fetch action list for key: ${actionListKey}`);
    return [];
  }
  const actionKeysStr = await env.PIXEL_CONFIG.get(actionListKey);


  if (!actionKeysStr) {
    console.log(`getActionKeys: Affiliate-specific action list key '${actionListKey}' not found in KV. No actions will be fired.`);
    // Cache the negative result (empty array) to avoid repeated KV lookups for non-existent keys
    setCache(cacheKey, [], 60); // Cache empty array for 60 seconds
    return []; // Return empty list if specific key not found
  }

  try {
    const actionKeys: string[] = JSON.parse(actionKeysStr);
    if (!Array.isArray(actionKeys)) {
       throw new Error('Parsed value is not an array');
    }
    console.log(`getActionKeys: Found ${actionKeys.length} actions for key '${actionListKey}'. Caching result.`);
    // Store in cache with a 60-second TTL
    setCache(cacheKey, actionKeys, 60);
    return actionKeys;
  } catch (e: any) {
    console.error(`getActionKeys: Failed to parse action list JSON for key '${actionListKey}'. Value: ${actionKeysStr}. Error: ${e.message}`);
    return []; // Return empty list on parse error
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
  const stateKey = internal_txn_id; 
  const clientSideActions: string[] = [];
  const serverSidePromises: Promise<void>[] = [];

  try {
    console.log(`[triggerInitialActions] Attempting to get state for key: ${stateKey}`);
    const stateString = await env.PIXEL_STATE.get(stateKey);
    if (!stateString) {
      console.error('[triggerInitialActions] State not found for txn', { internal_txn_id, stateKeyUsed: stateKey }); 
      return { clientSideActions: [] };
    }
    const state: PixelState = JSON.parse(stateString);
    console.log(`[triggerInitialActions] State found for ${stateKey}:`, state);


    const siteId = state.siteId; 
    if (!siteId) {
      console.error('[triggerInitialActions] siteId missing from state', { internal_txn_id });
      return { clientSideActions: [] };
    }

    if (state.processedInitial === true) { 
      console.log(`[triggerInitialActions] Already processed for ${internal_txn_id}`);
      return { clientSideActions: [] };
    }

    const updatedStateFields: Partial<PixelState> = { 
    	processedInitial: true, 
    	status: 'processed', 
    };
    context.waitUntil(
      env.PIXEL_STATE.put(stateKey, JSON.stringify({ ...state, ...updatedStateFields }))
        .then(() => console.log(`[triggerInitialActions] Successfully updated PIXEL_STATE for ${stateKey} to mark as processed.`))
        .catch(err => console.error('[triggerInitialActions] Failed to update KV state', { internal_txn_id, stateKeyUsed: stateKey, error: err.message })) 
    );

    const payoutSteps = 1; // Placeholder

    if (isNaN(payoutSteps) || payoutSteps < 1) {
      console.log(`[triggerInitialActions] Payout step (${payoutSteps}) prevents initial actions for ${internal_txn_id}`);
      return { clientSideActions: [] };
    }

    const isScrub = false; 
    const actionKeys = await getActionKeys(siteId, 'checkout', isScrub, request, env);

    if (actionKeys.length === 0) {
      console.log(`[triggerInitialActions] No actions to perform for ${internal_txn_id} based on getActionKeys result.`);
      return { clientSideActions: [] };
    }

    const actionDefinitions: { key: string; definition: ActionDefinition | null | undefined }[] = await Promise.all(
      actionKeys.map(async (key) => {
        const definitionKey = `${siteId}_${key}`; 
        const cacheKeyDef = `actionDef_${definitionKey}`; 
        let definition: ActionDefinition | null | undefined = getCache<ActionDefinition>(cacheKeyDef);

        if (definition !== undefined) { 
          console.log(`Cache hit for action definition: ${cacheKeyDef}`);
          return { key, definition };
        }

        console.log(`Cache miss for action definition: ${cacheKeyDef}. Fetching from KV.`);
        let definitionStr: string | null = null;
        if (env.PIXEL_CONFIG) {
            definitionStr = await env.PIXEL_CONFIG.get(definitionKey);
        } else {
            console.warn(`[triggerInitialActions] PIXEL_CONFIG KV namespace not available. Cannot fetch action definition for key: ${definitionKey}`);
        }
        
        try {
          definition = definitionStr ? JSON.parse(definitionStr) : null;
          setCache(cacheKeyDef, definition, 60);
          console.log(`Cached action definition for: ${cacheKeyDef}`);
          return { key, definition };
        } catch (parseError: any) {
          console.error(`Failed to parse action definition JSON for key '${definitionKey}'. Value: ${definitionStr}. Error: ${parseError.message}`);
          setCache(cacheKeyDef, null, 60);
          return { key, definition: null };
        }
      })
    );

    const dataSources: ParameterDataSources = { state, confirmationData, request, env };

    for (const { key: actionKey, definition } of actionDefinitions) {
      if (!definition) {
        console.error('[triggerInitialActions] Action definition not found or null', { internal_txn_id, actionKey }); 
        continue;
      }

      try {
        if (definition.type === 'server-side') {
          const populatedUrlResult = await populateParameters(definition.url, dataSources);
          const populatedUrl = typeof populatedUrlResult === 'string' ? populatedUrlResult : JSON.stringify(populatedUrlResult);

          const populatedHeadersResult = definition.headers
            ? await populateParameters(definition.headers, dataSources)
            : undefined;
          const populatedHeaders = typeof populatedHeadersResult === 'object' && populatedHeadersResult !== null
            ? populatedHeadersResult as Record<string, string>
            : undefined;

          let populatedBody: string | undefined = undefined;
          if (definition.body_template) {
             if (typeof definition.body_template === 'object') {
                 const populatedBodyObj = await populateParameters(definition.body_template, dataSources);
                 populatedBody = JSON.stringify(populatedBodyObj);
             } else { 
                 const populatedBodyResult = await populateParameters(definition.body_template, dataSources);
                 populatedBody = typeof populatedBodyResult === 'string' ? populatedBodyResult : undefined;
             }
          }
          serverSidePromises.push(
            executeServerSideAction(definition, populatedUrl, populatedHeaders, populatedBody, internal_txn_id, actionKey)
          );

        } else if (definition.type === 'client-side') {
          const populatedScriptResult = await populateParameters(definition.script_template, dataSources);
          if (typeof populatedScriptResult === 'string') {
            clientSideActions.push(populatedScriptResult);
          } else {
             console.error('[triggerInitialActions] Client-side script population did not return a string', { internal_txn_id, actionKey });
          }
        }
      } catch (paramError: any) {
         console.error('[triggerInitialActions] Parameter population error', {
             internal_txn_id,
             actionKey,
             errorMessage: paramError.message,
         });
      }
    }

    if (serverSidePromises.length > 0) {
      context.waitUntil(Promise.allSettled(serverSidePromises));
    }

    console.log(`[triggerInitialActions] Completed for ${internal_txn_id}. Returning ${clientSideActions.length} client actions.`);
    return { clientSideActions };

  } catch (error: any) {
    console.error('[triggerInitialActions] Unhandled error', { 
      internal_txn_id,
      errorMessage: error.message,
      stack: error.stack,
    });
    return { clientSideActions: [] }; 
  }
}

/**
 * Triggers upsell actions (pixels, postbacks) after successful upsell payment confirmation.
 * Handles idempotency based on the specific upsell step.
 */
export async function triggerUpsellActions(
  internal_txn_id: string,
  upsellStepNum: number, // e.g., 1, 2
  confirmationData: any, // Data from successful Sticky.io new_upsell or new_order (for PayPal upsell)
  env: Env,
  context: ExecutionContext,
  request: CfRequest // The original incoming request to the worker endpoint
): Promise<TriggerActionsResult> {
  const stateKey = internal_txn_id; 
  const clientSideActions: string[] = [];
  const serverSidePromises: Promise<void>[] = [];
  
  const processedFlagKey = `processed_Upsell_${upsellStepNum}` as keyof PixelState; 

  try {
    console.log(`[triggerUpsellActions] Attempting to get state for key: ${stateKey}, step: ${upsellStepNum}`);
    const stateString = await env.PIXEL_STATE.get(stateKey);
    if (!stateString) {
      console.error('[triggerUpsellActions] State not found for txn', { internal_txn_id, upsellStepNum, stateKeyUsed: stateKey }); 
      return { clientSideActions: [] };
    }
    const state: PixelState = JSON.parse(stateString);
    console.log(`[triggerUpsellActions] State found for ${stateKey}:`, state);

    const siteId = state.siteId; 
    if (!siteId) {
      console.error('[triggerUpsellActions] siteId missing from state', { internal_txn_id, upsellStepNum });
      return { clientSideActions: [] };
    }

    if (state[processedFlagKey] === true) {
      console.log(`[triggerUpsellActions] Step ${upsellStepNum} already processed for ${internal_txn_id}`);
      return { clientSideActions: [] };
    }

    const updatedStepStateFields: Partial<PixelState> = { 
      [processedFlagKey]: true,
    };
    context.waitUntil(
      env.PIXEL_STATE.put(stateKey, JSON.stringify({ ...state, ...updatedStepStateFields }))
        .then(() => console.log(`[triggerUpsellActions] Successfully updated PIXEL_STATE for ${stateKey} to mark upsell step ${upsellStepNum} as processed.`))
        .catch(err => console.error('[triggerUpsellActions] Failed to update KV state for upsell step', { internal_txn_id, upsellStepNum, stateKeyUsed: stateKey, error: err.message }))
    );

    const isScrub = false; 
    const eventName = `upsell${upsellStepNum}`;
    const actionKeys = await getActionKeys(siteId, eventName, isScrub, request, env);

    if (actionKeys.length === 0) {
      console.log(`[triggerUpsellActions] No actions to perform for step ${upsellStepNum} on ${internal_txn_id} based on getActionKeys result.`);
      return { clientSideActions: [] };
    }

    const actionDefinitions: { key: string; definition: ActionDefinition | null | undefined }[] = await Promise.all(
      actionKeys.map(async (key) => {
        const definitionKey = `${siteId}_${key}`; 
        const cacheKeyDef = `actionDef_${definitionKey}`; 
        let definition: ActionDefinition | null | undefined = getCache<ActionDefinition>(cacheKeyDef);

        if (definition !== undefined) { 
          console.log(`Cache hit for action definition: ${cacheKeyDef}`);
          return { key, definition };
        }
        console.log(`Cache miss for action definition: ${cacheKeyDef}. Fetching from KV.`);
        let definitionStr: string | null = null;
        if (env.PIXEL_CONFIG) {
            definitionStr = await env.PIXEL_CONFIG.get(definitionKey);
        } else {
            console.warn(`[triggerUpsellActions] PIXEL_CONFIG KV namespace not available. Cannot fetch action definition for key: ${definitionKey}`);
        }
        
         try {
          definition = definitionStr ? JSON.parse(definitionStr) : null;
          setCache(cacheKeyDef, definition, 60);
          console.log(`Cached action definition for: ${cacheKeyDef}`);
          return { key, definition };
        } catch (parseError: any) {
          console.error(`Failed to parse action definition JSON for key '${definitionKey}'. Value: ${definitionStr}. Error: ${parseError.message}`);
          setCache(cacheKeyDef, null, 60);
          return { key, definition: null };
        }
      })
    );

    const dataSources: ParameterDataSources = { state, confirmationData, request, env };

    for (const { key: actionKey, definition } of actionDefinitions) {
      if (!definition) {
        console.error('[triggerUpsellActions] Action definition not found or null', { internal_txn_id, upsellStepNum, actionKey }); 
        continue;
      }

       try {
          if (definition.type === 'server-side') {
            const populatedUrlResult = await populateParameters(definition.url, dataSources);
            const populatedUrl = typeof populatedUrlResult === 'string' ? populatedUrlResult : JSON.stringify(populatedUrlResult);

            const populatedHeadersResult = definition.headers
              ? await populateParameters(definition.headers, dataSources)
              : undefined;
            const populatedHeaders = typeof populatedHeadersResult === 'object' && populatedHeadersResult !== null
              ? populatedHeadersResult as Record<string, string>
              : undefined;

            let populatedBody: string | undefined = undefined;
            if (definition.body_template) {
               if (typeof definition.body_template === 'object') {
                   const populatedBodyObj = await populateParameters(definition.body_template, dataSources);
                   populatedBody = JSON.stringify(populatedBodyObj);
               } else { 
                   const populatedBodyResult = await populateParameters(definition.body_template, dataSources);
                   populatedBody = typeof populatedBodyResult === 'string' ? populatedBodyResult : undefined;
               }
            }
            serverSidePromises.push(
              executeServerSideAction(definition, populatedUrl, populatedHeaders, populatedBody, internal_txn_id, actionKey)
            );

          } else if (definition.type === 'client-side') {
            const populatedScriptResult = await populateParameters(definition.script_template, dataSources);
            if (typeof populatedScriptResult === 'string') {
              clientSideActions.push(populatedScriptResult);
            } else {
               console.error('[triggerUpsellActions] Client-side script population did not return a string', { internal_txn_id, upsellStepNum, actionKey });
            }
          }
       } catch (paramError: any) {
           console.error('[triggerUpsellActions] Parameter population error', {
               internal_txn_id,
               upsellStepNum,
               actionKey,
               errorMessage: paramError.message,
           });
       }
    }

    if (serverSidePromises.length > 0) {
      context.waitUntil(Promise.allSettled(serverSidePromises));
    }

    console.log(`[triggerUpsellActions] Completed for step ${upsellStepNum} on ${internal_txn_id}. Returning ${clientSideActions.length} client actions.`);
    return { clientSideActions };

  } catch (error: any) {
    console.error('[triggerUpsellActions] Unhandled error', { 
      internal_txn_id,
      upsellStepNum,
      errorMessage: error.message,
      stack: error.stack,
    });
    return { clientSideActions: [] }; 
  }
}