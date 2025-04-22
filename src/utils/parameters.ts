import { get } from 'lodash-es'; // Using lodash for safe nested property access
import type { Env as CanonicalEnv, PixelState as CanonicalPixelState } from '../types'; // Import canonical types

// Define a basic structure for expected data sources.
// Replace 'any' with more specific types if they are defined elsewhere in the project.
interface ConfirmationData {
  order_id?: string;
  total_amount?: number | string;
  sub_total?: number | string;
  email?: string;
  phone?: string;
  products?: Array<{
    sku?: string;
    product_name?: string; // Assuming name exists
    price?: number | string;
    quantity?: number | string;
    // ... other product fields
  }>;
  // ... other confirmation fields from Sticky.io API response
}

export interface DataSources {
  state: CanonicalPixelState; // Use imported PixelState
  confirmationData: ConfirmationData;
  request: Request;
  env: CanonicalEnv; // Use imported Env
}

/**
 * Safely retrieves a value from the dataSources object based on a parameter key.
 * Handles nested properties and provides default values or transformations.
 *
 * @param key The parameter key (e.g., "ORDER_ID", "CLICK_ID").
 * @param dataSources The object containing all available data.
 * @returns The resolved value, or an empty string if not found/applicable.
 */
function resolveParameterValue(key: string, dataSources: DataSources): string | number | boolean {
  const { state, confirmationData, request, env } = dataSources;

  switch (key) {
    // Confirmation Data
    case 'ORDER_ID':
      return get(confirmationData, 'order_id', '');
    case 'ORDER_TOTAL':
      return get(confirmationData, 'total_amount', '');
    case 'ORDER_SUBTOTAL':
      return get(confirmationData, 'sub_total', '');
    case 'USER_EMAIL':
      return get(confirmationData, 'email', '');
    case 'USER_PHONE':
      // Basic normalization example: remove non-digits. Adjust if needed.
      const phone = get(confirmationData, 'phone', '');
      return typeof phone === 'string' ? phone.replace(/\D/g, '') : '';
    case 'PRODUCT_SKU':
      // Example: return first product SKU, adjust if multiple needed
      return get(confirmationData, 'products[0].sku', '');
     case 'PRODUCT_NAME':
      return get(confirmationData, 'products[0].product_name', '');
     case 'PRODUCT_PRICE':
       return get(confirmationData, 'products[0].price', '');
     case 'PRODUCT_QUANTITY':
       return get(confirmationData, 'products[0].quantity', '');

    // Pixel State Data
    case 'CLICK_ID': // Everflow transaction_id
      return get(state, 'trackingParams.click_id', '');
    case 'AFFID':
      return get(state, 'trackingParams.affId', '');
     case 'C1':
       return get(state, 'trackingParams.c1', '');
     case 'C2': // Everflow offer_id
       return get(state, 'trackingParams.c2', '');
     case 'SUB1':
       return get(state, 'trackingParams.sub1', '');
     case 'SUB2':
       return get(state, 'trackingParams.sub2', '');
     case 'SUB3':
       return get(state, 'trackingParams.sub3', '');
     case 'SUB4':
       return get(state, 'trackingParams.sub4', '');
     case 'SUB5':
       return get(state, 'trackingParams.sub5', '');
     case 'UID':
       return get(state, 'trackingParams.uid', '');
     case 'SOURCE_ID':
       return get(state, 'trackingParams.source_id', '');
    case 'FBC':
      // Prioritize state, could potentially check cookies on request as fallback
      return get(state, 'trackingParams.fbc', '');
    case 'FBP':
      // Prioritize state, could potentially check cookies on request as fallback
      return get(state, 'trackingParams.fbp', '');
    case 'IS_SCRUB':
      return get(state, 'scrubDecision.isScrub', false); // Return boolean

    // Request Data
    case 'IP_ADDRESS':
      return request.headers.get('CF-Connecting-IP') || '';
    case 'USER_AGENT':
      return request.headers.get('User-Agent') || '';
    case 'PAGE_URL':
      return request.url || '';

    // Environment Data
    case 'FB_PIXEL_ID':
      return env.FB_PIXEL_ID || '';
    case 'FB_ACCESS_TOKEN':
      return env.FB_ACCESS_TOKEN || '';
    case 'FB_TEST_CODE':
      // Return empty string if not set, as it's optional
      return env.FB_TEST_CODE || '';

    // Derived/Generated Data
    case 'TIMESTAMP_UNIX':
      return Math.floor(Date.now() / 1000);
    case 'TIMESTAMP_ISO':
        return new Date().toISOString();

    // Default fallback
    default:
      console.warn(`Unknown parameter key: ${key}`);
      return ''; // Return empty string for unknown params
  }
}

/**
 * Recursively replaces PARAM: placeholders in a string, object, or array.
 *
 * @param template The string, object, or array containing placeholders.
 * @param dataSources The data sources for resolving parameters.
 * @returns The template with placeholders replaced.
 */
async function replacePlaceholdersRecursive(template: any, dataSources: DataSources): Promise<any> {
  if (typeof template === 'string') {
    // Replace PARAM:KEY placeholders in the string
    return template.replace(/PARAM:([A-Z_0-9]+)/g, (match, key) => {
      const value = resolveParameterValue(key, dataSources);
      // Ensure the replacement is a string
      return String(value);
    });
  } else if (Array.isArray(template)) {
    // Recursively process each item in the array
    return Promise.all(template.map(item => replacePlaceholdersRecursive(item, dataSources)));
  } else if (typeof template === 'object' && template !== null) {
    // Recursively process each value in the object
    const newObj: { [key: string]: any } = {};
    for (const key in template) {
      if (Object.prototype.hasOwnProperty.call(template, key)) {
        newObj[key] = await replacePlaceholdersRecursive(template[key], dataSources);

        // Omit optional fields like test_event_code if their value resolved to empty string
        if (key === 'test_event_code' && newObj[key] === '') {
            delete newObj[key];
        }
      }
    }
    // Handle specific cases like Facebook CAPI data structure where arrays need specific formatting
    if (newObj.em && Array.isArray(newObj.em) && newObj.em.length === 1 && newObj.em[0] === '') {
        // If email resolved to empty string, keep the array structure but empty
        newObj.em = [];
    }
     if (newObj.ph && Array.isArray(newObj.ph) && newObj.ph.length === 1 && newObj.ph[0] === '') {
        // If phone resolved to empty string, keep the array structure but empty
        newObj.ph = [];
    }

    return newObj;
  } else {
    // Return non-string/object/array types as is
    return template;
  }
}


/**
 * Populates placeholders (e.g., PARAM:ORDER_ID) in a template string or object
 * using data from various sources like KV state, API responses, request details, and environment variables.
 *
 * @param template The template string or object containing PARAM: placeholders.
 * @param dataSources An object containing the necessary data sources (`state`, `confirmationData`, `request`, `env`).
 * @returns A promise resolving to the populated template (string or object).
 * @throws Error if essential data sources are missing.
 */
export async function populateParameters(
  template: string | object,
  dataSources: DataSources
): Promise<string | object> {
  if (!dataSources || !dataSources.state || !dataSources.confirmationData || !dataSources.request || !dataSources.env) {
    console.error("populateParameters: Missing essential data sources.", dataSources);
    throw new Error("Missing essential data sources for parameter population.");
  }

  try {
    // Use lodash-es if available, otherwise fallback to basic check
     // Ensure lodash-es is installed: npm install lodash-es @types/lodash-es
     // If not using lodash, remove the import and the get() usage in resolveParameterValue
     // and implement manual safe navigation.

    return await replacePlaceholdersRecursive(template, dataSources);
  } catch (error) {
    console.error("Error during parameter population:", error);
    // Depending on desired behavior, either re-throw or return template unprocessed/partially processed
    // For now, re-throwing to indicate failure clearly.
    throw new Error(`Parameter population failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Example Usage (Conceptual - requires actual data)
/*
async function test() {
  const mockState: CanonicalPixelState = { // Use CanonicalPixelState for mock
    internal_txn_id: 'test-123',
    timestamp_created: new Date().toISOString(),
    status: 'success',
    trackingParams: {
      click_id: 'ef-click-xyz',
      affId: 'network1',
      c1: 'affiliate123',
      fbc: 'fb.1.testfbc',
      fbp: 'fb.1.testfbp',
    },
    scrubDecision: { isScrub: false, targetCampaignId: '4' },
    // Add other required fields from CanonicalPixelState if necessary
    processed_Initial: false,
    timestamp_processed_Initial: null,
    processed_Upsell_1: false,
    timestamp_processed_Upsell_1: null,
    processed_Upsell_2: false,
    timestamp_processed_Upsell_2: null,
    // ... etc for other upsells
  };

  const mockConfirmation: ConfirmationData = {
    order_id: 'sticky-order-456',
    total_amount: 49.99,
    email: 'test@example.com',
    phone: '123-456-7890',
    products: [{ sku: 'PROD001' }]
  };

  const mockRequest = new Request("https://example.com/checkout?sub1=hello", {
      headers: {
          'CF-Connecting-IP': '192.168.1.1',
          'User-Agent': 'TestAgent/1.0'
      }
  });

  const mockEnv: CanonicalEnv = { // Use CanonicalEnv for mock
    PIXEL_STATE: {} as any, // Mock KV Namespace
    PIXEL_CONFIG: {} as any, // Mock KV Namespace
    AUTH_KV: {} as any, // Mock KV Namespace
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD_HASH: 'hash',
    JWT_SECRET: 'secret',
    // Add other required env vars from CanonicalEnv
    FB_PIXEL_ID: 'fpix_123',
    FB_ACCESS_TOKEN: 'fb_token_abc',
    // FB_TEST_CODE: 'TEST12345' // Optional
  };

  const dataSources: DataSources = {
    state: mockState,
    confirmationData: mockConfirmation,
    request: mockRequest,
    env: mockEnv,
  };

  const stringTemplate = "Order ID: PARAM:ORDER_ID, Click ID: PARAM:CLICK_ID, IP: PARAM:IP_ADDRESS, Timestamp: PARAM:TIMESTAMP_UNIX";
  const objectTemplate = {
    event: "Purchase",
    userData: {
      email: "PARAM:USER_EMAIL",
      fbc: "PARAM:FBC",
      fbp: "PARAM:FBP",
      ip: "PARAM:IP_ADDRESS",
      agent: "PARAM:USER_AGENT"
    },
    customData: {
      orderId: "PARAM:ORDER_ID",
      value: "PARAM:ORDER_TOTAL",
      isScrubbed: "PARAM:IS_SCRUB", // Note: boolean becomes string here
      optionalCode: "PARAM:FB_TEST_CODE" // Will be empty string if not in env
    },
    timestamp: "PARAM:TIMESTAMP_UNIX"
  };

  try {
    const populatedString = await populateParameters(stringTemplate, dataSources);
    console.log("Populated String:", populatedString);

    const populatedObject = await populateParameters(objectTemplate, dataSources);
    console.log("Populated Object:", JSON.stringify(populatedObject, null, 2));
  } catch (e) {
      console.error("Test failed:", e);
  }
}

// test(); // Uncomment to run test locally if needed
*/