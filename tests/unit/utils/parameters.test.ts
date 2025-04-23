import { describe, it, expect, vi, beforeEach } from 'vitest';
import { populateParameters, DataSources } from '../../../src/utils/parameters';
import { Env, PixelState } from '../../../src/types'; // Import necessary types
import { getCookie, getQueryParam } from '../../../src/utils/request'; // Import getCookie
// Removed crypto import

// Mock utility functions that might be called internally by populateParameters
// We need to mock the module AND import the function if we want to use vi.mocked() on it
vi.mock('../../../src/utils/request', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../src/utils/request')>();
    return {
        ...original, // Keep original implementations unless overridden
        getCookie: vi.fn((req, name) => name === '_fbp' ? 'fb.1.123.456' : null),
        getQueryParam: vi.fn((req, name) => name === 'sub1' ? 'subValue1' : null),
    };
});
// Removed crypto mock


// --- Test Data Setup ---

// Helper to create a default PixelState with all required fields
const createDefaultState = (overrides: Partial<PixelState> = {}): PixelState => ({
    internal_txn_id: 'test-txn-id',
    siteId: 'test-site', // Added default siteId
    timestamp_created: '2024-04-22T12:00:00.000Z',
    status: 'pending',
    trackingParams: {
        click_id: 'test-click-id',
        affId: 'network1',
        c1: 'subValue1', // Match getQueryParam mock for consistency if needed
        c2: 'subValue2',
        sub1: 'subValue1', // Explicitly include if needed
        sub2: 'subValue2',
        sub3: 'subValue3',
        sub4: 'subValue4',
        sub5: 'subValue5',
        utm_source: 'google',
        utm_medium: 'cpc',
        campaignId: 'camp123',
    },
    scrubDecision: {
        isScrub: false,
        targetCampaignId: '100',
    },
    processed_Initial: false,
    processed_Upsell_1: false, // Added
    processed_Upsell_2: false, // Added
    timestamp_processed_Initial: null, // Added
    timestamp_processed_Upsell_1: null, // Added
    ...overrides,
});

const defaultConfirmationData = {
    order_id: 'order-123',
    total_amount: 100.50,
    sub_total: 90.00,
    currency: 'USD',
    email: 'test@example.com',
    phone: '123-456-7890',
    firstName: 'John',
    lastName: 'Doe',
    city: 'Anytown',
    state: 'CA',
    country: 'US',
    zipCode: '90210',
    products: [
        { sku: 'SKU001', quantity: 1, price: 50.00 },
        { sku: 'SKU002', quantity: 2, price: 20.00 },
    ],
};

const defaultRequest = new Request('https://example.com/checkout?sub1=hello&utm_source=google', {
    headers: {
        'User-Agent': 'TestAgent/1.0',
        'CF-Connecting-IP': '192.168.1.1',
        'Referer': 'https://previous.example.com',
        'Cookie': '_fbp=fb.1.123.456', // Match getCookie mock
    },
});

const defaultEnv: Env = {
    PIXEL_STATE: {} as any, // Mock KV, not directly used by populateParameters logic itself
    PIXEL_CONFIG: {} as any,
    ADMIN_UI_ASSETS: {} as any,
    JWT_SECRET: 'secret',
    FB_PIXEL_ID: 'fb-pixel-123',
    FB_ACCESS_TOKEN: 'fb-token-abc',
    // FB_TEST_CODE: 'TEST12345', // Test code added specifically in relevant tests
    GA_MEASUREMENT_ID: 'G-ABCDEF123',
    GA_API_SECRET: 'ga-secret-xyz',
    EF_COMPANY_ID: 'ef-comp-456',
    EF_API_KEY: 'ef-key-789',
    // Add other required Env properties if any
};

// Define a specific type for overrides in the helper function
interface DataSourcesOverrides {
    state?: Partial<PixelState>;
    confirmationData?: Partial<typeof defaultConfirmationData>; // More specific type
    request?: Request;
    env?: Partial<Env>; // Explicitly allow Partial<Env> for overrides
}


// Helper to create DataSources using the specific override type
const createDataSources = (overrides: DataSourcesOverrides = {}): DataSources => {
    // Merge state if provided
    const finalState = createDefaultState(overrides.state);
    // Merge confirmationData if provided
    const finalConfirmationData = { ...defaultConfirmationData, ...(overrides.confirmationData || {}) };
     // Merge env if provided
    const finalEnv = { ...defaultEnv, ...(overrides.env || {}) };

    return {
        state: finalState,
        confirmationData: finalConfirmationData,
        request: overrides.request || defaultRequest,
        env: finalEnv, // Use the merged env, which is now correctly typed as Env
    };
};


// --- Test Suite ---

describe('Parameter Utilities', () => {

    // Reset mocks before each test if needed, especially for functions with specific implementations per test
    beforeEach(() => {
        // Use vi.mocked safely now that functions are imported
        vi.mocked(getCookie).mockClear();
        vi.mocked(getQueryParam).mockClear();
        // Removed sha256 mock clear

        // Reset to default mock implementations if they were changed in specific tests
        vi.mocked(getCookie).mockImplementation((req, name) => name === '_fbp' ? 'fb.1.123.456' : null);
        vi.mocked(getQueryParam).mockImplementation((req, name) => name === 'sub1' ? 'subValue1' : null);
        // Removed sha256 mock reset
    });


    describe('populateParameters', () => {

        it('should replace placeholders in a string template', async () => {
            const template = "Order ID: PARAM:ORDER_ID, Total: PARAM:ORDER_TOTAL, Click ID: PARAM:CLICK_ID, FB Pixel: PARAM:FB_PIXEL_ID";
            const dataSources = createDataSources();
            const expected = `Order ID: ${defaultConfirmationData.order_id}, Total: ${defaultConfirmationData.total_amount}, Click ID: ${dataSources.state.trackingParams.click_id}, FB Pixel: ${defaultEnv.FB_PIXEL_ID}`;
            const result = await populateParameters(template, dataSources);
            expect(result).toBe(expected);
        });

        it('should replace placeholders in an object template', async () => {
            const template = {
                event: 'Purchase',
                order: 'PARAM:ORDER_ID',
                value: 'PARAM:ORDER_TOTAL',
                user: {
                    // emailHash: 'PARAM:USER_EMAIL_HASHED', // Removed
                    ip: 'PARAM:IP_ADDRESS',
                    email: 'PARAM:USER_EMAIL', // Add plain email if needed
                },
                tracking: {
                    fbp: 'PARAM:FBP',
                    sub1: 'PARAM:SUB1',
                },
                // Include an optional param that won't be in env for this test
                fb_test_code: 'PARAM:FB_TEST_CODE',
                custom: {
                    timestamp: 'PARAM:TIMESTAMP_ISO',
                    affiliate: 'PARAM:AFFID',
                    is_scrubbed: 'PARAM:IS_SCRUBBED',
                    sub1: 'PARAM:SUB1', // Test duplicate param usage
                }
            };
            const dataSources = createDataSources();
            // Expected object *without* fb_test_code because it resolves to "" and gets removed
            const expected = {
                event: 'Purchase',
                order: defaultConfirmationData.order_id,
                value: String(defaultConfirmationData.total_amount), // Values are stringified
                user: {
                    // emailHash removed
                    ip: '192.168.1.1',
                    email: defaultConfirmationData.email,
                },
                tracking: {
                    fbp: 'fb.1.123.456',
                    sub1: dataSources.state.trackingParams.sub1,
                },
                // fb_test_code should be removed by the cleanup logic
                custom: {
                    timestamp: dataSources.state.timestamp_created,
                    affiliate: dataSources.state.trackingParams.affId,
                    is_scrubbed: String(dataSources.state.scrubDecision?.isScrub), // Boolean stringified
                    sub1: dataSources.state.trackingParams.sub1,
                }
            };
            const result = await populateParameters(template, dataSources);
            expect(result).toEqual(expected);
        });

        it('should include FB_TEST_CODE when present in env', async () => {
            const template = {
                event: 'Purchase',
                order: 'PARAM:ORDER_ID',
                test_event_code: 'PARAM:FB_TEST_CODE', // Use the standard FB CAPI field name
            };
            const testCode = 'TEST12345';
            // Pass the partial env override, which createDataSources now handles correctly
            const dataSources = createDataSources({
                env: { FB_TEST_CODE: testCode }
            });
            // Verify the env in dataSources has the test code AND other default env vars
            expect(dataSources.env.FB_TEST_CODE).toBe(testCode);
            expect(dataSources.env.JWT_SECRET).toBe(defaultEnv.JWT_SECRET); // Check another default var

            const expected = {
                event: 'Purchase',
                order: defaultConfirmationData.order_id,
                test_event_code: testCode, // Expect the code to be present
            };
            const result = await populateParameters(template, dataSources);
            expect(result).toEqual(expected);
        });

        it('should omit test_event_code field if FB_TEST_CODE is empty or not present', async () => {
             const template = {
                event: 'Purchase',
                order: 'PARAM:ORDER_ID',
                test_event_code: 'PARAM:FB_TEST_CODE',
            };
            // Test with FB_TEST_CODE explicitly empty
            let dataSources = createDataSources({ env: { FB_TEST_CODE: '' } });
             // Verify the env in dataSources has the empty test code AND other default env vars
            expect(dataSources.env.FB_TEST_CODE).toBe('');
            expect(dataSources.env.JWT_SECRET).toBe(defaultEnv.JWT_SECRET); // Check another default var

            let expected = {
                event: 'Purchase',
                order: defaultConfirmationData.order_id,
                // test_event_code should be removed
            };
            let result = await populateParameters(template, dataSources);
            expect(result).toEqual(expected);

            // Test with FB_TEST_CODE undefined (default env)
            dataSources = createDataSources(); // Uses default env without FB_TEST_CODE
             expected = { // Re-declare expected for clarity
                event: 'Purchase',
                order: defaultConfirmationData.order_id,
                // test_event_code should be removed
            };
            result = await populateParameters(template, dataSources);
            expect(result).toEqual(expected);
        });


        it('should handle nested objects and arrays', async () => {
            const template = {
                level1: {
                    param1: 'PARAM:ORDER_ID',
                    level2: {
                        param2: 'PARAM:USER_AGENT',
                        arr: [
                            'static',
                            'PARAM:CURRENCY',
                            { nestedArrObj: 'PARAM:IP_ADDRESS' }
                        ]
                    }
                }
            };
            const dataSources = createDataSources();
            const expected = {
                level1: {
                    param1: defaultConfirmationData.order_id,
                    level2: {
                        param2: 'TestAgent/1.0',
                        arr: [
                            'static',
                            defaultConfirmationData.currency,
                            { nestedArrObj: '192.168.1.1' }
                        ]
                    }
                }
            };
            const result = await populateParameters(template, dataSources);
            expect(result).toEqual(expected);
        });

        it('should return empty string for unknown parameters', async () => {
            const template = "Known: PARAM:ORDER_ID, Unknown: PARAM:NON_EXISTENT_PARAM";
            const dataSources = createDataSources();
            // Expect unknown param to be replaced with empty string
            const expected = `Known: ${defaultConfirmationData.order_id}, Unknown: `;
            const result = await populateParameters(template, dataSources);
            expect(result).toBe(expected);
        });

        it('should handle parameters returning non-string values correctly in string templates', async () => {
            // PARAM:ORDER_TOTAL returns number, PARAM:IS_SCRUBBED returns boolean
            const template = "Total: PARAM:ORDER_TOTAL, Scrubbed: PARAM:IS_SCRUBBED";
            const dataSources = createDataSources();
            const expected = `Total: ${String(defaultConfirmationData.total_amount)}, Scrubbed: ${String(dataSources.state.scrubDecision?.isScrub)}`;
            const result = await populateParameters(template, dataSources);
            expect(result).toBe(expected);
        });

        it('should handle empty or missing data gracefully', async () => {
            const template = {
                order: 'PARAM:ORDER_ID', // Will be present
                email: 'PARAM:USER_EMAIL', // Will be empty string
                fbp: 'PARAM:FBP', // Will be empty string (mock returns null)
                sub4: 'PARAM:SUB4', // Will be empty string
            };

            // Create headers object excluding 'Cookie'
            const headersWithoutCookie = new Headers(defaultRequest.headers);
            headersWithoutCookie.delete('Cookie');

             const dataSources = createDataSources({
                 // Override confirmation data to remove email
                 confirmationData: { ...defaultConfirmationData, email: undefined },
                 // Override state to remove sub4
                 state: createDefaultState({ trackingParams: { ...createDefaultState().trackingParams, sub4: undefined } }),
                 // Override request with headers excluding Cookie
                 request: new Request(defaultRequest.url, { headers: headersWithoutCookie })
             });

             // Mock getCookie to return null for this specific test case since the header is missing
             vi.mocked(getCookie).mockReturnValue(null);

            const expected = {
                order: defaultConfirmationData.order_id,
                // email, fbp, sub4 should be removed by cleanup logic as they resolve to ""
            };
            const result = await populateParameters(template, dataSources);
            expect(result).toEqual(expected);
             // Restore mock in beforeEach
        });

        it('should throw error if essential data sources are missing', async () => {
            const template = 'PARAM:ORDER_ID';
            // Example: Missing 'state'
            const incompleteDataSources = {
                // state: createDefaultState(), // Missing state
                confirmationData: defaultConfirmationData,
                request: defaultRequest,
                env: defaultEnv,
            } as any; // Use 'as any' to bypass initial TS check for the test

            await expect(populateParameters(template, incompleteDataSources))
                .rejects
                .toThrow("Missing essential data sources for parameter population.");
        });

    });
});