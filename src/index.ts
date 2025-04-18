import { Env } from './types';

interface PaymentData {
  cardType?: string;
  encryptedCard?: string;
  encryptedExpiry?: string;
  encryptedCvv?: string;
}

interface StickyPayload {
  firstName?: string;
  lastName?: string;
  billingFirstName?: string;
  billingLastName?: string;
  billingAddress1?: string;
  billingAddress2?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountry?: string;
  phone?: string;
  email?: string;
  payment?: PaymentData;
  shippingId?: string;
  shippingAddress1?: string;
  shippingAddress2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  shippingCountry?: string;
  billingSameAsShipping?: string;
  tranType?: string;
  ipAddress?: string;
  campaignId?: string;
  offers?: any[];
  AFID?: string;
  SID?: string;
  AFFID?: string;
  C1?: string;
  C2?: string;
  C3?: string;
  AID?: string;
  OPT?: string;
  click_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}
import { handleRequest } from './handler';
import { handleAdminRequest } from './admin/router';
import { authenticateRequest } from './admin/middleware/auth';
import { decryptData } from './utils/encryption';

// --- Interfaces for Order Confirmation (matching frontend) ---
interface Address {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    country: string;
    zip: string;
}

interface Product {
    product_name: string;
    quantity: number;
    unitPrice: number; // Assuming Sticky.io provides this
    regPrice?: number;
    imageUrl?: string;
}

interface OrderConfirmation {
    orderNumbers: string; // Assuming Sticky.io provides this
    firstName: string;
    lastName: string;
    shippingAddress: Address;
    products: Product[];
    shippingFee: number; // Assuming Sticky.io provides this
    creditCardType?: string; // Added credit card type (adjust type if needed)
}
// --- End Interfaces ---

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
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://space-7z6.pages.dev' // Added production frontend origin
];

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
      // Added /api/checkout and renamed /api/process-checkout to /api/checkout-rules
      // Added /api/order-details/* for CORS preflight
      // Added /api/order-details for CORS preflight (now POST)
      if (request.method === 'OPTIONS' && (pathname === '/api/checkout' || pathname === '/api/checkout-rules' || pathname === '/api/page-pixels' || pathname === '/api/order-details')) {
        return handleOptions(request);
      }

      // Handle POST request for determining checkout rules/actions (based on scrub)
      else if (pathname === '/api/checkout-rules' && request.method === 'POST') {
        try {
          const body = await request.json();
          // Removed unused vars for this specific endpoint's logic
          const { siteId } = body as any; // Type assertion for simplicity

          if (!siteId) {
            return new Response('Missing siteId in request body', { status: 400 });
          }

          console.log(`[Worker] Determining checkout rules for siteId: ${siteId}`, body);

          // --- Checkout Rules Logic ---
          // 1. Fetch scrubPercent and action keys from KV based on siteId
          const scrubPercentKey = `${siteId}_rule_checkoutScrubPercent`;
          const normalActionsKey = `${siteId}_rule_checkoutNormalActions`;
          const scrubActionKey = `${siteId}_rule_checkoutScrubAction`; // Note: singular based on user's open tabs

          console.log(`[Worker] Fetching KV: ${scrubPercentKey}, ${normalActionsKey}, ${scrubActionKey}`);

          const [scrubPercentValue, normalActionKeysValue, scrubActionKeyValue] = await Promise.all([
             env.PIXEL_CONFIG.get(scrubPercentKey),
             env.PIXEL_CONFIG.get(normalActionsKey),
             env.PIXEL_CONFIG.get(scrubActionKey)
          ]);

          const scrubPercent = parseInt(scrubPercentValue || '0');
          const normalActionKeys = JSON.parse(normalActionKeysValue || '[]');
          // Assuming scrub action is a single key, not an array based on KV filename `drivebright_rule_checkoutScrubAction.json`
          // If it *can* be multiple, adjust parsing and KV data.
          const scrubActionKeys = scrubActionKeyValue ? [scrubActionKeyValue] : []; // Wrap in array if found

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
                 // Parameter replacement will happen in the main /api/checkout endpoint
                 // after the Sticky.io call. Here we just return the raw definitions.
                 actionsToExecute.push(actionDefinition);
               } catch (e) {
                  console.error(`[Worker] Failed to parse action definition for key ${key}: ${e instanceof Error ? e.message : String(e)}`, actionJson);
                }
             } else {
               console.warn(`[Worker] Action definition not found in KV for key ${key}`);
             }
          }
         // --- End Checkout Rules Logic ---

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
          console.error('[Worker] Error determining checkout rules:', error);
          return new Response(`Error determining checkout rules: ${error.message}`, { status: 500 });
        }
      }

     // --- Handle POST request for fetching order details ---
     else if (pathname === '/api/order-details' && request.method === 'POST') {
       try {
         const body = await request.json() as { orderId?: string };
         const orderId = body.orderId;

         if (!orderId) {
           return addCorsHeaders(new Response(JSON.stringify({ message: 'Missing orderId in request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
         }

         // Ensure orderId is treated as a string for the API call payload
         const orderIdStr = String(orderId);

         console.log(`[Worker] Fetching order details for orderId: ${orderIdStr}`);

         // Get Sticky.io credentials and base URL
         const stickyBaseUrl = 'https://techcommerceunlimited.sticky.io/api/v1'; // Provided base URL
         const stickyApiUser = env.STICKY_USERNAME;
         const stickyApiPass = env.STICKY_PASSWORD;

         if (!stickyApiUser || !stickyApiPass) {
           console.error('[Worker] Sticky.io API credentials missing in environment secrets for order fetch.');
           throw new Error('Sticky.io API credentials missing');
         }

         // Use the correct order_view endpoint
         const stickyUrl = `${stickyBaseUrl}/order_view`;
         const stickyPayload = { order_id: [orderIdStr] }; // Send order_id as an array in the body

         console.log(`[Worker] Calling Sticky.io POST: ${stickyUrl}`);
         console.log(`[Worker] Sticky.io Payload: ${JSON.stringify(stickyPayload)}`);

         const stickyResponse = await fetch(stickyUrl, {
           method: 'POST',
           headers: {
             'Authorization': 'Basic ' + btoa(`${stickyApiUser}:${stickyApiPass}`),
             'Content-Type': 'application/json',
             'Accept': 'application/json'
           },
           body: JSON.stringify(stickyPayload)
         });

         console.log('[Worker] Sticky.io POST Order Response Status:', stickyResponse.status);

         // Read body regardless of status for potential error messages
         const responseBodyText = await stickyResponse.text();
         console.log('[Worker] Sticky.io POST Order Response Body Text:', responseBodyText);

         if (!stickyResponse.ok) {
           // Attempt to parse error, fallback to text
           let errorMessage = `Sticky.io API Error: ${stickyResponse.statusText} (Status: ${stickyResponse.status})`;
           try {
               const errorJson = JSON.parse(responseBodyText);
               errorMessage += ` - ${errorJson.message || errorJson.status || JSON.stringify(errorJson)}`;
           } catch {
               errorMessage += ` - ${responseBodyText}`;
           }
           console.error(errorMessage);
           throw new Error(errorMessage);
         }

         // Parse the successful response
         const stickyData = JSON.parse(responseBodyText) as any; // Type assertion for simplicity

         // Check for API-level errors even if HTTP status is OK
         if (stickyData.response_code !== '100') {
            console.error(`[Worker] Sticky.io API returned error code ${stickyData.response_code}: ${stickyData.error_message || JSON.stringify(stickyData)}`);
            throw new Error(`Sticky.io API Error: ${stickyData.error_message || 'Unknown error'} (Code: ${stickyData.response_code})`);
         }

         console.log('[Worker] Sticky.io POST Order Response Body JSON:', JSON.stringify(stickyData));


         // --- Map Sticky.io response to OrderConfirmation (Updated based on example) ---
         const mappedOrder: OrderConfirmation = {
           orderNumbers: stickyData.order_id?.toString() || orderIdStr,
           firstName: stickyData.shipping_first_name || stickyData.billing_first_name || 'N/A',
           lastName: stickyData.shipping_last_name || stickyData.billing_last_name || 'N/A',
           shippingAddress: {
             address1: stickyData.shipping_street_address || '',
             address2: stickyData.shipping_street_address2 || undefined,
             city: stickyData.shipping_city || '',
             state: stickyData.shipping_state || '', // Assuming state code (e.g., 'MO')
             country: stickyData.shipping_country || '', // Assuming country code (e.g., 'US')
             zip: stickyData.shipping_postcode || '',
           },
           products: (stickyData.products || []).map((item: any) => ({
             product_name: item.name || 'Unknown Product',
             quantity: parseInt(item.product_qty || '1'), // Use product_qty
             unitPrice: parseFloat(item.price || '0'),
             // regPrice: parseFloat(item.regular_price || '0'), // If available
             // imageUrl: item.image_url || undefined // If available
           })),
           // Use totals_breakdown if available, otherwise fallback
           shippingFee: parseFloat(stickyData.totals_breakdown?.shipping ?? stickyData.shipping_amount ?? '0'),
           // Assuming Sticky.io returns credit card type like this:
           creditCardType: stickyData.credit_card_type,
         };
         // --- End Mapping ---

         const response = new Response(JSON.stringify(mappedOrder), {
           headers: { 'Content-Type': 'application/json' },
           status: 200
         });
         return addCorsHeaders(response, request);

       } catch (error: any) {
         console.error('[Worker] Error fetching order details:', error);
         // Ensure error response is JSON
         const response = new Response(JSON.stringify({ message: `Error fetching order details: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
         return addCorsHeaders(response, request);
       }
     }
     // --- End GET Order Details Handler ---

      // Handle POST request for the full checkout process (Now at the root path '/')
      else if (pathname === '/' && request.method === 'POST') {
        try {
          console.log('[Worker] Received POST request at root path for checkout.');
          const checkoutData = await request.json() as any; // Type assertion for simplicity
          const { siteId } = checkoutData;

          if (!siteId) {
            const errorMsg = 'Missing siteId in request body';
            console.error(`[Worker] Bad Request: ${errorMsg}`);
            // Return the error message in the response body
            return new Response(JSON.stringify({ success: false, error: errorMsg }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          console.log(`[Worker] Starting checkout process for siteId: ${siteId}`, checkoutData);

          // --- 1. Call Sticky.io New Order API ---
          let stickyOrderId: string | null = null;
          let stickyResponseData: any = null;
          try {
            // Get Sticky.io credentials from Worker Secrets
            const stickyApiUrl = env.STICKY_API_URL;
            const stickyApiUser = env.STICKY_USERNAME; // Production secret name
            const stickyApiPass = env.STICKY_PASSWORD; // Production secret name

            if (!stickyApiUrl || !stickyApiUser || !stickyApiPass) {
              console.error('[Worker] Sticky.io API credentials missing in environment secrets.');
              throw new Error('Sticky.io API credentials missing');
            }

            // Construct the Sticky.io New Order payload
            // Assuming checkoutData contains nested objects like 'customer', 'shipping', 'billing', 'payment', 'analytics', 'offers'
            // Helper function to determine card type (basic example)
            const getCardType = (num: string | undefined): string | undefined => {
              if (!num) return undefined;
              if (num.startsWith('4')) return 'VISA';
              if (num.startsWith('5')) return 'MASTERCARD';
              if (num.startsWith('34') || num.startsWith('37')) return 'AMEX';
              if (num.startsWith('6')) return 'DISCOVER';
              // Add more checks if needed
              return undefined; // Return undefined if type is unknown or not supported
            };

            const billingAddress = checkoutData.customer?.billingAddress;
            const shippingAddress = checkoutData.customer?.shippingAddress;
            const useShippingForBilling = !billingAddress || Object.keys(billingAddress).length === 0;

            const stickyPayload = {
              // --- Customer & Billing ---
              firstName: checkoutData.customer?.firstName,
              lastName: checkoutData.customer?.lastName,
              // Use customer name if billing address is same as shipping
              billingFirstName: useShippingForBilling ? checkoutData.customer?.firstName : billingAddress?.firstName,
              billingLastName: useShippingForBilling ? checkoutData.customer?.lastName : billingAddress?.lastName,
              billingAddress1: useShippingForBilling ? shippingAddress?.address1 : billingAddress?.address1,
              billingAddress2: useShippingForBilling ? shippingAddress?.address2 : billingAddress?.address2,
              billingCity: useShippingForBilling ? shippingAddress?.city : billingAddress?.city,
              billingState: useShippingForBilling ? shippingAddress?.state : billingAddress?.state,
              billingZip: useShippingForBilling ? shippingAddress?.zip : billingAddress?.zip,
              billingCountry: useShippingForBilling ? shippingAddress?.country : billingAddress?.country,
              phone: checkoutData.customer?.phone,
              email: checkoutData.customer?.email,
              billingSameAsShipping: useShippingForBilling ? 'YES' : 'NO',

              // --- Payment Details (Flattened & Formatted - Top Level) ---
              creditCardType: getCardType(checkoutData.payment?.cardNumber),
              creditCardNumber: checkoutData.payment?.cardNumber,
              expirationDate: checkoutData.payment?.expirationMonth && checkoutData.payment?.expirationYear
                                ? `${checkoutData.payment.expirationMonth}${checkoutData.payment.expirationYear.slice(-2)}`
                                : undefined,
              CVV: checkoutData.payment?.cvv,

              // --- Shipping Details ---
              shippingId: checkoutData.products?.[0]?.ship_id?.toString() || '2',
              shippingFirstName: checkoutData.customer?.firstName, // REQUIRED
              shippingLastName: checkoutData.customer?.lastName, // REQUIRED
              shippingAddress1: shippingAddress?.address1,
              shippingAddress2: shippingAddress?.address2,
              shippingCity: shippingAddress?.city,
              shippingState: shippingAddress?.state,
              shippingZip: shippingAddress?.zip,
              shippingCountry: shippingAddress?.country,

              // --- Transaction & Offer ---
              tranType: 'Sale',
              ipAddress: request.headers.get('CF-Connecting-IP') || '127.0.0.1', // Added fallback IP
              // --- TEMP HARDCODING FOR drivebright TEST ---
              campaignId: siteId === 'drivebright' ? '4' : checkoutData.analytics?.campaignId,
              offers: siteId === 'drivebright'
                ? [{ offer_id: "1", product_id: "4", billing_model_id: "2", quantity: "1" }] // Changed billing_model_id to 2
                : checkoutData.offers,
              // --- END TEMP HARDCODING ---

              // --- Tracking ---
              AFID: checkoutData.analytics?.afid,
              SID: checkoutData.analytics?.sid,
              AFFID: checkoutData.analytics?.affId,
              C1: checkoutData.analytics?.c1,
              C2: checkoutData.analytics?.c2,
              C3: checkoutData.analytics?.c3, // Added from C# example
              AID: checkoutData.analytics?.aid, // Added from C# example
              OPT: checkoutData.analytics?.opt, // Added from C# example
              click_id: checkoutData.analytics?.click_id || checkoutData.analytics?.clickId, // Added from C# example (corrected mapping)
              notes: checkoutData.notes, // Added from C# example (assuming notes might be top-level)
              // --- UTM ---
              utm_source: checkoutData.analytics?.utm_source,
              utm_medium: checkoutData.analytics?.utm_medium,
              utm_campaign: checkoutData.analytics?.utm_campaign,
              utm_content: checkoutData.analytics?.utm_content,
              utm_term: checkoutData.analytics?.utm_term,
              // Add other fields from example if needed (sessionId, etc.)
            };
            // Securely log payment payload without sensitive data
            const { creditCardNumber, CVV, expirationDate, ...safePayload } = stickyPayload;
            // Log the payload structure being sent, marking sensitive fields
            console.log('[Worker] Sending payload to Sticky.io:', {
              ...safePayload,
              creditCardNumber: '[REDACTED]',
              expirationDate: '[REDACTED]',
              CVV: '[REDACTED]'
            });

            console.log('[Worker] Calling Sticky.io API URL:', stickyApiUrl); // Log the URL being called
            const stickyResponse = await fetch(stickyApiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                // Basic Auth using production secret names
                'Authorization': 'Basic ' + btoa(`${stickyApiUser}:${stickyApiPass}`)
              },
              body: JSON.stringify(stickyPayload)
            });

            stickyResponseData = await stickyResponse.json();
            console.log('[Worker] Sticky.io Response Status:', stickyResponse.status);
            console.log('[Worker] Sticky.io Response Body:', JSON.stringify(stickyResponseData));

            if (!stickyResponse.ok || stickyResponseData.response_code !== '100') { // Check Sticky.io success code
              throw new Error(`Sticky.io API Error: ${stickyResponseData.error_message || 'Unknown error'} (Code: ${stickyResponseData.response_code})`);
            }

            // Extract the order ID from the Sticky.io response
            stickyOrderId = stickyResponseData.order_id; // Confirmed from example response
            if (!stickyOrderId) {
               throw new Error('Sticky.io response did not contain an order_id.');
            }
            console.log(`[Worker] Sticky.io order created successfully. Order ID: ${stickyOrderId}`);

          } catch (stickyError: any) {
            console.error('[Worker] Error calling Sticky.io API:', stickyError);
            // Decide how to handle Sticky.io failure - maybe return error, maybe still fire *some* pixels?
            // For now, return an error.
            return new Response(`Checkout failed: ${stickyError.message}`, { status: 500 });
          }

          // --- 2. Determine Actions based on Rules (Scrub/Normal/Campaign) ---
          // Reuse logic similar to /api/checkout-rules, but potentially add campaign logic
          const scrubPercentKey = `${siteId}_rule_checkoutScrubPercent`;
          const normalActionsKey = `${siteId}_rule_checkoutNormalActions`;
          const scrubActionKey = `${siteId}_rule_checkoutScrubAction`;
          const campaignRulesKey = `${siteId}_rule_checkoutCampIdRules`; // Key for campaign rules

          console.log(`[Worker] Fetching KV for checkout rules: ${scrubPercentKey}, ${normalActionsKey}, ${scrubActionKey}, ${campaignRulesKey}`);

          const [scrubPercentValue, normalActionKeysValue, scrubActionKeyValue, campaignRulesValue] = await Promise.all([
             env.PIXEL_CONFIG.get(scrubPercentKey),
             env.PIXEL_CONFIG.get(normalActionsKey),
             env.PIXEL_CONFIG.get(scrubActionKey),
             env.PIXEL_CONFIG.get(campaignRulesKey) // Added missing promise for campaign rules
          ]);

          const scrubPercent = parseInt(scrubPercentValue || '0');
          const normalActionKeys = JSON.parse(normalActionKeysValue || '[]');
          const scrubActionKeys = scrubActionKeyValue ? [scrubActionKeyValue] : [];

          const isScrub = Math.random() * 100 < scrubPercent;
          const decision = isScrub ? 'scrub' : 'normal';
          let actionKeysToExecute = isScrub ? scrubActionKeys : normalActionKeys;

          // --- Apply Campaign-Specific Rules ---
          const requestCampaignId = checkoutData.analytics?.campaignId;
          if (requestCampaignId && campaignRulesValue) {
            try {
              const campaignRules: { campaignId: string; actions?: string[]; replace?: boolean }[] = JSON.parse(campaignRulesValue);
              const matchingCampaignRule = campaignRules.find(rule => rule.campaignId === requestCampaignId);

              if (matchingCampaignRule && matchingCampaignRule.actions) {
                console.log(`[Worker] Found matching campaign rule for ${requestCampaignId}:`, matchingCampaignRule);
                if (matchingCampaignRule.replace) {
                  console.log(`[Worker] Replacing base actions with campaign actions.`);
                  actionKeysToExecute = matchingCampaignRule.actions;
                } else {
                  console.log(`[Worker] Appending campaign actions to base actions.`);
                  actionKeysToExecute = [...actionKeysToExecute, ...matchingCampaignRule.actions];
                  // Optional: Remove duplicates if necessary
                  // actionKeysToExecute = [...new Set(actionKeysToExecute)];
                }
              } else {
                 console.log(`[Worker] No specific rule found for campaignId ${requestCampaignId} in ${campaignRulesKey}`);
              }
            } catch (e) {
              console.error(`[Worker] Failed to parse or apply campaign rules from ${campaignRulesKey}: ${e instanceof Error ? e.message : String(e)}`, campaignRulesValue);
            }
          } else if (requestCampaignId) {
             console.log(`[Worker] Campaign ID ${requestCampaignId} provided, but no campaign rules found at ${campaignRulesKey}`);
          }
          // --- End Campaign Rules ---


          // --- 3. Fetch and Process Action Definitions ---
          const actionsToExecute = [];
          console.log(`[Worker] Action keys to fetch definitions for (${decision}):`, actionKeysToExecute);
          for (const key of actionKeysToExecute) {
             const actionJson = await env.PIXEL_CONFIG.get(key);
             if (actionJson) {
               try {
                 const actionDefinition = JSON.parse(actionJson);
                 console.log(`[Worker] Fetched action definition for ${key}:`, JSON.stringify(actionDefinition));

                 // --- Parameter Replacement Logic (Checkout Context) ---
                 if (actionDefinition.params && typeof actionDefinition.params === 'object') {
                   console.log(`[Worker] Processing parameters for action ${key}`);
                   for (const paramKey in actionDefinition.params) {
                     let paramValue = actionDefinition.params[paramKey];
                     if (typeof paramValue === 'string' && paramValue.startsWith('PARAM:')) {
                       const sourceParamName = paramValue.substring(6);
                       let replacementValue: string | number | null = null;

                       // Map known PARAM names to checkoutData or stickyResponseData
                       // Map known PARAM names to checkoutData or stickyResponseData
                       // Using optional chaining ?. for safety
                       if (sourceParamName === 'order_id') {
                         replacementValue = stickyOrderId;
                       } else if (sourceParamName === 'total') {
                         // Assuming total might be in sticky response or checkout data
                         replacementValue = stickyResponseData?.orderTotal || checkoutData.order?.total;
                       } else if (sourceParamName === 'email') {
                          replacementValue = checkoutData.customer?.email;
                       } else if (sourceParamName === 'c1') { // Affiliate ID
                         replacementValue = checkoutData.analytics?.c1;
                       } else if (sourceParamName === 'c2' || sourceParamName === 'campid') { // Campaign ID
                         replacementValue = checkoutData.analytics?.campaignId;
                       } else if (sourceParamName === 'affid') { // Network ID
                          replacementValue = checkoutData.analytics?.affId;
                       } else if (sourceParamName === 'clickid') {
                          replacementValue = checkoutData.analytics?.clickId;
                       } else if (sourceParamName === 'sub1' || sourceParamName === 'AFID') { // Map AFID to sub1 if needed
                          replacementValue = checkoutData.analytics?.afid;
                       } else if (sourceParamName === 'sub2' || sourceParamName === 'SID') { // Map SID to sub2 if needed
                          replacementValue = checkoutData.analytics?.sid;
                       } else if (sourceParamName === 'sub3' || sourceParamName === 'C3') { // Map C3 to sub3 if needed
                          replacementValue = checkoutData.analytics?.c3;
                       } else if (sourceParamName === 'transaction_id') {
                          // Use Sticky.io transactionID if available, otherwise maybe clickid?
                          replacementValue = stickyResponseData?.transactionID !== 'Not Available' ? stickyResponseData?.transactionID : checkoutData.analytics?.clickId;
                       }
                       // Add other mappings like product IDs, quantities, customer name etc. if required by actions
                       // else if (sourceParamName === 'product_ids') {
                       //   replacementValue = checkoutData.offers?.map(o => o.product_id).join(',');
                       // }

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

          // --- 4. Return Redirect Response ---
          // Construct the redirect URL. Ideally, this comes from config/KV.
          // For now, hardcoding to fix the test. Use the Next.js app's URL.
          // TODO: Make this configurable via environment variables or KV store.
          const nextJsBaseUrl = 'http://localhost:3000'; // Assuming Next.js runs on port 3000 locally
          const redirectUrl = new URL(nextJsBaseUrl);
          redirectUrl.pathname = '/upsell1/'; // Set the target path
          // Optionally add order ID or other params if needed by upsell page
          redirectUrl.searchParams.set('orderId', stickyOrderId || ''); // Pass order ID as query param

          console.log(`[Worker] Checkout successful. Redirecting to: ${redirectUrl.toString()}`);

          // Return a JSON response to the Next.js API route indicating success and the order ID
          const response = new Response(JSON.stringify({ success: true, orderId: stickyOrderId }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
          });
          console.log('[Worker] Returning successful checkout JSON response:', { status: response.status, headers: Object.fromEntries(response.headers.entries()), body: JSON.stringify({ success: true, orderId: stickyOrderId }) });
          return addCorsHeaders(response, request);

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
         console.log(`[Worker] Attempting to fetch page rules from KV key: ${pageRulesKey}`); // DETAILED LOG 1
         const pageRulesRawValue = await env.PIXEL_CONFIG.get(pageRulesKey);
         console.log(`[Worker] Raw value received from KV for ${pageRulesKey}:`, pageRulesRawValue); // DETAILED LOG 2
         let pageRules: { pattern: string; type: string }[] = [];
         let parseError: Error | null = null;
         if (pageRulesRawValue) {
           try {
             pageRules = JSON.parse(pageRulesRawValue);
             console.log(`[Worker] Successfully parsed pageRules for ${pageRulesKey}:`, pageRules); // DETAILED LOG 3
           } catch (e: any) {
             parseError = e;
             console.error(`[Worker] JSON PARSE ERROR for ${pageRulesKey}:`, e.message, "Raw value:", pageRulesRawValue); // DETAILED LOG 4
           }
         } else {
            console.warn(`[Worker] Key ${pageRulesKey} NOT FOUND in KV.`); // DETAILED LOG 5
         }
         // Original log replaced by more detailed ones above
         // console.log('[Worker] Fetched pageRules:', pageRulesJson ? pageRules : 'Not Found or Invalid JSON');

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