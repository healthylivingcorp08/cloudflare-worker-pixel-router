import { Env, PixelState } from '../types';
import { getCookie, getQueryParam } from './request';
// Removed crypto import

// Define the structure for the data sources used in parameter population
export interface DataSources {
    state: PixelState;
    confirmationData: any; // Data from the confirmation page (e.g., order details)
    request: Request;      // Incoming Cloudflare Request object
    env: Env;              // Environment variables
}

// Type guard to check if a value is a valid parameter key
type ParameterKey = `PARAM:${string}`;
function isParameterKey(key: string): key is ParameterKey {
    return key.startsWith('PARAM:');
}

// Helper function to safely access nested properties
function getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

// Function to get the value for a specific parameter
async function getParameterValue(param: ParameterKey, dataSources: DataSources): Promise<string | number | boolean | undefined> {
    const { state, confirmationData, request, env } = dataSources;
    const headers = request.headers;

    // --- Essential Data Source Check ---
    // Add checks for the most critical data sources needed by common parameters
    if (!state || !confirmationData || !request || !env) {
        console.error("populateParameters: Missing essential data sources.", { state, confirmationData, request, env });
        throw new Error("Missing essential data sources for parameter population.");
    }

    // --- Parameter Mapping ---
    switch (param) {
        // Request Data
        case 'PARAM:PAGE_URL':
            return request.url;
        case 'PARAM:USER_AGENT':
            return headers.get('User-Agent') || '';
        case 'PARAM:IP_ADDRESS':
            return headers.get('CF-Connecting-IP') || ''; // Cloudflare specific header
        case 'PARAM:REFERRER':
            return headers.get('Referer') || ''; // Note the spelling 'Referer'

        // Cookie Data (using helper)
        case 'PARAM:FBP':
            return getCookie(request, '_fbp') || '';
        case 'PARAM:FBC':
            // Special handling for fbc (check query param first, then cookie)
            return getQueryParam(request, 'fbclid') || getCookie(request, '_fbc') || '';
        case 'PARAM:TTCLID':
            return getQueryParam(request, 'ttclid') || ''; // TikTok Click ID Query Param

        // Query Parameter Data (using helper)
        case 'PARAM:CLICK_ID': // Example: Everflow click ID
            return state.trackingParams.click_id || getQueryParam(request, 'click_id') || getQueryParam(request, 'ef_click_id') || '';
        case 'PARAM:AFFID': // Example: Affiliate ID
            return state.trackingParams.affId || getQueryParam(request, 'affId') || getQueryParam(request, 'affid') || '';
        case 'PARAM:SUB1':
            return state.trackingParams.c1 || getQueryParam(request, 'c1') || getQueryParam(request, 'sub1') || '';
        case 'PARAM:SUB2':
            return state.trackingParams.c2 || getQueryParam(request, 'c2') || getQueryParam(request, 'sub2') || '';
        case 'PARAM:SUB3':
            return state.trackingParams.c3 || getQueryParam(request, 'c3') || getQueryParam(request, 'sub3') || '';
        case 'PARAM:SUB4':
            return state.trackingParams.sub4 || getQueryParam(request, 'sub4') || ''; // Assuming sub4 might be less common
        case 'PARAM:SUB5':
            return state.trackingParams.sub5 || getQueryParam(request, 'sub5') || ''; // Assuming sub5 might be less common
        case 'PARAM:UTM_SOURCE':
            return getQueryParam(request, 'utm_source') || '';
        case 'PARAM:UTM_MEDIUM':
            return getQueryParam(request, 'utm_medium') || '';
        case 'PARAM:UTM_CAMPAIGN':
            return getQueryParam(request, 'utm_campaign') || '';
        case 'PARAM:UTM_TERM':
            return getQueryParam(request, 'utm_term') || '';
        case 'PARAM:UTM_CONTENT':
            return getQueryParam(request, 'utm_content') || '';
        case 'PARAM:GCID': // Google Click ID
            return getQueryParam(request, 'gclid') || '';

        // Confirmation Data (ensure confirmationData exists)
        case 'PARAM:ORDER_ID':
            return confirmationData?.order_id || '';
        case 'PARAM:ORDER_TOTAL':
            // Ensure it's a number or string representation of a number
            return confirmationData?.total_amount ?? '';
        case 'PARAM:ORDER_SUBTOTAL':
            return confirmationData?.sub_total ?? '';
        case 'PARAM:CURRENCY':
            return confirmationData?.currency || 'USD'; // Default to USD if not provided
        case 'PARAM:USER_EMAIL':
            return confirmationData?.email || '';
        case 'PARAM:USER_PHONE':
            // Basic phone number cleaning (remove non-digits) - adjust as needed
            const phone = confirmationData?.phone || '';
            return phone.replace(/\D/g, '');
        case 'PARAM:USER_FIRST_NAME':
            return confirmationData?.firstName || '';
        case 'PARAM:USER_LAST_NAME':
            return confirmationData?.lastName || '';
        case 'PARAM:USER_CITY':
            return confirmationData?.city || '';
        case 'PARAM:USER_STATE': // State code (e.g., CA)
            return confirmationData?.state || '';
        case 'PARAM:USER_COUNTRY': // Country code (e.g., US)
            return confirmationData?.country || '';
        case 'PARAM:USER_ZIP':
            return confirmationData?.zipCode || '';
        case 'PARAM:PRODUCTS_SKU_LIST': // Comma-separated list of product SKUs
             return confirmationData?.products?.map((p: any) => p.sku).join(',') || '';
        case 'PARAM:PRODUCTS_QUANTITY_LIST': // Comma-separated list of quantities
             return confirmationData?.products?.map((p: any) => p.quantity).join(',') || '';
        case 'PARAM:PRODUCTS_PRICE_LIST': // Comma-separated list of prices
             return confirmationData?.products?.map((p: any) => p.price).join(',') || '';

        // Removed Hashed User Data Parameters

        // State Data
        case 'PARAM:INTERNAL_TXN_ID':
            return state.internal_txn_id;
        case 'PARAM:TIMESTAMP_ISO': // ISO 8601 format timestamp of pixel creation
            return state.timestamp_created;
        case 'PARAM:TIMESTAMP_UNIX': // Unix epoch timestamp (seconds)
            return Math.floor(new Date(state.timestamp_created).getTime() / 1000);
        case 'PARAM:IS_SCRUBBED': // Boolean indicating if the transaction was scrubbed
            return state.scrubDecision?.isScrub ?? false;
        case 'PARAM:SCRUB_TARGET_CAMPAIGN_ID': // Target campaign ID after scrubbing
            return state.scrubDecision?.targetCampaignId || '';

        // Environment Variables
        case 'PARAM:FB_PIXEL_ID':
            return env.FB_PIXEL_ID || '';
        case 'PARAM:FB_ACCESS_TOKEN':
            return env.FB_ACCESS_TOKEN || '';
        case 'PARAM:FB_TEST_CODE': // Optional Facebook test event code
            return env.FB_TEST_CODE || ''; // Return empty string if not set
        case 'PARAM:GA_MEASUREMENT_ID':
            return env.GA_MEASUREMENT_ID || '';
        case 'PARAM:GA_API_SECRET':
            return env.GA_API_SECRET || '';
        case 'PARAM:EF_COMPANY_ID': // Example: Everflow Company ID
            return env.EF_COMPANY_ID || '';
        case 'PARAM:EF_API_KEY': // Example: Everflow API Key
            return env.EF_API_KEY || '';

        // Default: return empty string for unknown parameters
        default:
            console.warn(`Unknown parameter: ${param}`);
            return '';
    }
}

// --- Overloads for populateParameters ---
/**
 * Populates placeholders in a template string with dynamic data.
 */
export async function populateParameters(
    template: string,
    dataSources: DataSources
): Promise<string>;

/**
 * Populates placeholders in a template object with dynamic data.
 */
export async function populateParameters<T extends object>(
    template: T,
    dataSources: DataSources
): Promise<T>;

/**
 * Implementation of populateParameters.
 * Populates placeholders in a template string or object with dynamic data.
 * Placeholders are in the format PARAM:KEY_NAME.
 *
 * @param template The string or object template containing placeholders.
 * @param dataSources An object containing all necessary data sources.
 * @returns The populated template (string or object).
 */
export async function populateParameters(
    template: string | object,
    dataSources: DataSources
): Promise<string | object> { // Implementation signature returns the union type
    if (typeof template === 'string') {
        // Handle string templates
        let populatedString = template;
        const paramRegex = /PARAM:[A-Z0-9_]+/g;
        const params = template.match(paramRegex) as ParameterKey[] | null;

        if (params) {
            for (const param of params) {
                const value = await getParameterValue(param, dataSources);
                // Replace all occurrences of the parameter
                // Ensure value is stringified appropriately
                const replacement = (typeof value === 'boolean' || typeof value === 'number') ? String(value) : (value || '');
                populatedString = populatedString.replace(new RegExp(param.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replacement);
            }
        }
        return populatedString; // Return type matches the string overload

    } else if (typeof template === 'object' && template !== null) {
        // Handle object templates (deep copy and recursive population)
        const originalTemplate = JSON.parse(JSON.stringify(template)); // Keep original for optional key check
        const populatedObject = JSON.parse(JSON.stringify(template)); // Work on a copy

        async function populateRecursively(obj: any, originalObj: any) {
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    const value = obj[key];
                    const originalValue = originalObj ? originalObj[key] : undefined; // Get corresponding original value

                    if (typeof value === 'string' && isParameterKey(value)) {
                        const paramValue = await getParameterValue(value, dataSources);
                        // Store the resolved value (could be empty string)
                        obj[key] = (typeof paramValue === 'boolean' || typeof paramValue === 'number') ? String(paramValue) : (paramValue || '');
                    } else if (Array.isArray(value)) {
                        // Recurse into arrays
                        obj[key] = await Promise.all(value.map(async (item, index) => {
                            const originalItem = Array.isArray(originalValue) ? originalValue[index] : undefined;
                            if (typeof item === 'string' && isParameterKey(item)) {
                                const paramValue = await getParameterValue(item, dataSources);
                                return (typeof paramValue === 'boolean' || typeof paramValue === 'number') ? String(paramValue) : (paramValue || '');
                            } else if (typeof item === 'object' && item !== null) {
                                await populateRecursively(item, originalItem);
                                return item; // Return the modified object
                            }
                            return item; // Return non-string/non-object items unchanged
                        }));
                    } else if (typeof value === 'object' && value !== null) {
                        // Recurse into nested objects
                        await populateRecursively(value, originalValue);
                    }
                }
            }
        }

        await populateRecursively(populatedObject, originalTemplate);

        // --- Post-population cleanup for optional parameters ---
        // Iterate again to remove keys where the original template had a PARAM:*
        // and the resolved value is now an empty string.
        function cleanupOptionalParams(obj: any, originalObj: any) {
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    const value = obj[key];
                    const originalValue = originalObj ? originalObj[key] : undefined;

                    if (typeof value === 'object' && value !== null) {
                        // Recurse first to handle nested objects
                        cleanupOptionalParams(value, originalValue);
                    } else if (value === '' && typeof originalValue === 'string' && isParameterKey(originalValue)) {
                        // If current value is empty string AND original was a PARAM:*, delete the key
                        // Add specific exceptions if needed (e.g., if PARAM:SOME_KEY should allow empty string)
                        // Example exception: if (originalValue === 'PARAM:ALLOW_EMPTY') continue;
                        delete obj[key];
                    }
                }
            }
        }

        cleanupOptionalParams(populatedObject, originalTemplate);

        return populatedObject; // Return type matches the object overload
    } else {
        // Should not happen due to type constraints, but satisfy TS
        return template;
    }
}