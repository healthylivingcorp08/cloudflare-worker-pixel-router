import { Env } from './types';
import { handleRequest } from './handler';
import { handleAdminRequest } from './admin/router';
import { authenticateRequest } from './admin/middleware/auth';

// Helper function to check if a path is public within the admin scope
function isAdminPublicPath(pathname: string): boolean {
  const publicPaths = [
    '/admin/login',
    '/admin/api/auth/login'
  ];
  // Check for exact match or match with trailing slash
  return publicPaths.some(path => pathname === path || pathname === path + '/');
}

// --- CORS Configuration ---
// Adjust allowedOrigins for your production frontend URL
const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000']; // Add production URL later

function handleOptions(request: Request) {
  const origin = request.headers.get('Origin');
  if (origin && allowedOrigins.includes(origin)) {
    // Handle CORS preflight requests.
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', // Allow POST for API, GET for potential future use
        'Access-Control-Allow-Headers': 'Content-Type', // Allow Content-Type header
        'Access-Control-Max-Age': '86400', // Cache preflight response for 1 day
      },
    });
  } else {
    // Handle standard OPTIONS request.
    return new Response(null, {
      headers: {
        Allow: 'POST, GET, OPTIONS',
      },
    });
  }
}

function addCorsHeaders(response: Response, request: Request): Response {
   const origin = request.headers.get('Origin');
   if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
   }
   return response;
}
// --- End CORS Configuration ---


export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      console.log('[Worker] Request URL:', url.toString());
      console.log('[Worker] Request Path:', pathname);

      // Handle admin routes
      if (pathname === '/admin' || pathname === '/admin/' || isAdminPublicPath(pathname)) {
        // Only handle /admin, /admin/, /admin/login, /admin/api/*
        console.log('[Worker] Public or base admin path, routing directly to admin handler');
        return handleAdminRequest(request, env);
      }
      if (pathname.startsWith('/admin/api/')) {
        // Authenticate and handle protected admin API routes
        console.log('[Worker] Protected admin API path, authenticating...');
        const authResult = await authenticateRequest(request, env);
        if (authResult instanceof Response) {
          console.log('[Worker] Auth failed or redirected for API');
          return authResult;
        }
        console.log('[Worker] Auth success, handling protected admin API request');
        const response = await handleAdminRequest(authResult, env);
        console.log('[Worker] Admin API response status:', response.status);
        return response;
      }
      // Let Wrangler serve all other static assets (including /admin/ui/*)

      // Handle CORS preflight requests for API routes
      if (request.method === 'OPTIONS' && (pathname === '/api/process-checkout' || pathname === '/api/page-pixels')) {
        return handleOptions(request);
      }

      // Handle POST request for checkout processing
      else if (pathname === '/api/process-checkout' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { siteId, campid, affid, clickid, total } = body as any; // Type assertion for simplicity

          if (!siteId) {
            return new Response('Missing siteId in request body', { status: 400 });
          }

          console.log(`[Worker] Processing checkout for siteId: ${siteId}`, body);

          // --- Placeholder Logic ---
          // 1. Fetch scrubPercent, action keys, action definitions from KV based on siteId
          const scrubPercent = parseInt(await env.PIXEL_CONFIG.get(`${siteId}_rule_checkoutScrubPercent`) || '0');
          const normalActionKeys = JSON.parse(await env.PIXEL_CONFIG.get(`${siteId}_rule_checkoutNormalActions`) || '[]');
          const scrubActionKeys = JSON.parse(await env.PIXEL_CONFIG.get(`${siteId}_rule_checkoutScrubAction`) || '[]');

          // 2. Perform scrub calculation
          const isScrub = Math.random() * 100 < scrubPercent;
          const decision = isScrub ? 'scrub' : 'normal';
          const actionKeysToExecute = isScrub ? scrubActionKeys : normalActionKeys;

          // 3. Fetch full action definitions for the chosen keys
          const actionsToExecute = []; // Array to hold full action objects
          for (const key of actionKeysToExecute) {
             const actionJson = await env.PIXEL_CONFIG.get(key); // e.g., drivebright_action_fbPurchase
             if (actionJson) {
               try {
                 const actionDefinition = JSON.parse(actionJson);
                 // TODO: Fill CONTEXT placeholders (like clickid, total) if needed
                 actionsToExecute.push(actionDefinition);
               } catch (e) { console.error(`[Worker] Failed to parse action definition for key ${key}`, e); }
             } else {
               console.warn(`[Worker] Action definition not found for key ${key}`);
             }
          }
          // --- End Placeholder Logic ---

          const responsePayload = {
            decision: decision,
            actionsToExecute: actionsToExecute
          };

          const response = new Response(JSON.stringify(responsePayload), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
          });
          return addCorsHeaders(response, request); // Add CORS headers

        } catch (error: any) {
          console.error('[Worker] Error processing checkout:', error);
          return new Response(`Error processing checkout: ${error.message}`, { status: 500 });
        }
      }

    // Handle POST request for page pixel determination
    else if (pathname === '/api/page-pixels' && request.method === 'POST') {
      try {
       const body = await request.json();
       // Added c1, ef_transaction_id
       const { siteId, url, affid, c1, campid, ef_transaction_id } = body as any;

       if (!siteId) {
         return new Response('Missing siteId in request body', { status: 400 });
       }

       // Log received parameters including c1 and ef_transaction_id
       console.log(`[Worker] Getting page pixels for siteId: ${siteId}`, { siteId, url, affid, c1, campid, ef_transaction_id });

       let actionKeysToExecute: string[] = [];
       const actionsToExecute: any[] = []; // Array to hold full action objects

       try {
         // 1. Fetch Page Rules from KV
         const pageRulesKey = `${siteId}_rule_pageRules`;
         console.log(`[Worker] Fetching page rules from KV key: ${pageRulesKey}`); // DEBUG LOG
         const pageRulesJson = await env.PIXEL_CONFIG.get(pageRulesKey);
         const pageRules: { pattern: string; type: string }[] = pageRulesJson ? JSON.parse(pageRulesJson) : [];
         console.log('[Worker] Fetched pageRules:', pageRulesJson ? pageRules : 'Not Found or Invalid JSON'); // DEBUG LOG

         // 2. Determine Page Type
         let pageType = 'unknown';
         // Use the path from the *frontend page URL* sent in the body
         const currentPath = new URL((body as any).url).pathname; // Use body.url here with type assertion
         console.log(`[Worker] Frontend page path for matching: ${currentPath}`);

         for (const rule of pageRules) {
           console.log(`[Worker] Comparing path '${currentPath}' with pattern '${rule.pattern}'`); // DEBUG LOG
           // Basic matching (e.g., startsWith). Adjust if more complex matching needed.
           if (currentPath.startsWith(rule.pattern)) {
             pageType = rule.type;
             console.log(`[Worker] --> Match found! Setting pageType to: ${pageType}`); // DEBUG LOG
             break; // Use the first match
           }
         }

         // 3. Fetch Affiliate Rules based on Page Type
         if (pageType !== 'unknown' && pageType !== 'checkout') { // Don't run affiliate rules on checkout
           const affRulesKey = `${siteId}_rule_${pageType}AffIdRules`; // e.g., drivebright_rule_interstitialAffIdRules
           console.log(`[Worker] Fetching AffId rules using key: ${affRulesKey}`);
           const affRulesJson = await env.PIXEL_CONFIG.get(affRulesKey);

           if (!affRulesJson) {
              console.warn(`[Worker] AffId rules not found in KV for key: ${affRulesKey}`);
           } else {
             const affRules: { affId: string; actions: string[] }[] = JSON.parse(affRulesJson);

             // 4. Find Matching Affiliate Rule
             const requestAffId = affid || 'default'; // Use 'default' if no affid provided
             console.log(`[Worker] Looking for AffId rule matching: '${requestAffId}'`);
             let matchedRule = affRules.find(rule => rule.affId === requestAffId);

             if (!matchedRule) {
                console.log(`[Worker] No exact match for '${requestAffId}', falling back to 'default'.`);
                matchedRule = affRules.find(rule => rule.affId === 'default'); // Fallback to default
             }

             if (matchedRule) {
               console.log(`[Worker] Found matching AffId rule:`, matchedRule);
               actionKeysToExecute = matchedRule.actions;
             } else {
                console.log(`[Worker] No matching AffId rule found for '${requestAffId}' or default.`);
             }
           }
         } else {
            console.log(`[Worker] Skipping affiliate rules for page type: ${pageType}`);
         }

         // 5. Fetch full action definitions for the chosen keys
         console.log(`[Worker] Action keys to fetch definitions for:`, actionKeysToExecute);
         for (const key of actionKeysToExecute) {
            const actionJson = await env.PIXEL_CONFIG.get(key);
            if (actionJson) {
              try {
                const actionDefinition = JSON.parse(actionJson);
                console.log(`[Worker] Fetched action definition for ${key}:`, JSON.stringify(actionDefinition));

                // --- Parameter Replacement Logic ---
                if (actionDefinition.params && typeof actionDefinition.params === 'object') {
                  console.log(`[Worker] Processing parameters for action ${key}`);
                  for (const paramKey in actionDefinition.params) {
                    let paramValue = actionDefinition.params[paramKey];
                    if (typeof paramValue === 'string' && paramValue.startsWith('PARAM:')) {
                      const sourceParamName = paramValue.substring(6); // Get name after "PARAM:"
                      let replacementValue: string | null = null;

                      // Map known PARAM names to body properties
                      // TODO: Make this mapping more robust if needed
                      if (sourceParamName === 'c1') {
                        replacementValue = (body as any).c1;
                      } else if (sourceParamName === 'c2') {
                        replacementValue = (body as any).campid; // Map PARAM:c2 to body.campid
                      } else if (sourceParamName === 'affid') {
                         replacementValue = (body as any).affid;
                      } else if (sourceParamName === 'campid') {
                         replacementValue = (body as any).campid;
                      }
                      // --- Map _ef_transaction_id ---
                      else if (sourceParamName === '_ef_transaction_id') {
                         replacementValue = (body as any).ef_transaction_id; // Get from body
                      }
                      // --- End Map ---
                      // Add other mappings for params present in the body (sub1, sub2, uid, etc.)
                      // else if (sourceParamName === 'sub1') { replacementValue = (body as any).sub1; }
                      // ... etc ...


                      // Replace value, defaulting to empty string if source is null/undefined
                      actionDefinition.params[paramKey] = replacementValue ?? '';
                      console.log(`[Worker] --> Replaced ${paramKey}: '${paramValue}' with '${actionDefinition.params[paramKey]}'`);
                    }
                  }
                }
                // --- End Parameter Replacement ---

                actionsToExecute.push(actionDefinition);
              } catch (e) { console.error(`[Worker] Failed to parse action definition for key ${key}`, e); }
            } else {
              console.warn(`[Worker] Action definition not found in KV for key ${key}`);
            }
         }

       } catch (kvParseError) {
          console.error('[Worker] Error fetching/parsing rules from KV:', kvParseError);
          // Decide if you want to return an error or empty actions
       }

       const responsePayload = {
         actionsToExecute: actionsToExecute
       };

       const response = new Response(JSON.stringify(responsePayload), {
         headers: { 'Content-Type': 'application/json' },
         status: 200
       });
       return addCorsHeaders(response, request); // Add CORS headers

     } catch (error: any) {
       console.error('[Worker] Error getting page pixels:', error);
       return new Response(`Error getting page pixels: ${error.message}`, { status: 500 });
     }
   }

      // Handle regular pixel routing requests (original handler, if still needed)
      // console.log('[Worker] Routing to original pixel handler');
      // return handleRequest(request, env);

      // Default fallback if no route matches
      console.log('[Worker] No matching route found');
      return new Response('Not Found', { status: 404 });

    } catch (error) {
      console.error('[Worker] Global error:', error);
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};