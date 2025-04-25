import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { triggerInitialActions, triggerUpsellActions } from '../../src/actions'; // Correct function names
// Import the real DataSources type for the mock signature, but we'll use a local version for the variable
import { populateParameters, DataSources as ParameterDataSources } from '../../src/utils/parameters';
import type { Env, PixelState, SiteConfig, PageConfig, ApiEndpointConfig, PixelConfig } from '../../src/types'; // Removed ActionDefinition
import type { KVNamespace, ExecutionContext, Request as CfRequest } from '@cloudflare/workers-types'; // Added imports

// Mock dependencies
vi.mock('../../src/utils/parameters');
vi.stubGlobal('fetch', vi.fn()); // Mock global fetch

// Mock console methods
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// --- Local Type Definitions (Copied from src/actions.ts) ---
interface ActionDefinitionBase {
  type: 'server-side' | 'client-side';
  provider: string; // Assuming provider exists, add if needed based on actual use
}
interface ServerSideActionDefinition extends ActionDefinitionBase {
  type: 'server-side';
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body_template?: Record<string, any> | string;
}
interface ClientSideActionDefinition extends ActionDefinitionBase {
  type: 'client-side';
  script_template: string;
}
type ActionDefinition = ServerSideActionDefinition | ClientSideActionDefinition;
// --- End Local Type Definitions ---

// --- Local DataSources Type for Test ---
// Use standard Request type here as the mock doesn't need CfRequest specifics
interface TestDataSources {
    state: PixelState;
    confirmationData: any;
    request: Request; // Use standard Request
    env: Env;
}
// --- End Local DataSources Type ---


// --- Mocks & Helpers ---
const mockPopulateParameters = populateParameters as Mock;
const mockFetch = fetch as Mock;

const createMockEnv = (): Env => ({
    PIXEL_CONFIG: { get: vi.fn() } as unknown as KVNamespace,
    // Update PIXEL_STATE mock for put to return a Promise
    PIXEL_STATE: {
        get: vi.fn(),
        put: vi.fn().mockResolvedValue(undefined) // Mock put to return a resolved promise
    } as unknown as KVNamespace,
    STICKY_API_URL: 'mock-sticky-url',
    STICKY_USERNAME: 'mock-sticky-user',
    STICKY_PASSWORD: 'mock-sticky-pass',
    JWT_SECRET: 'mock-jwt-secret',
    ADMIN_UI_ASSETS: {} as unknown as KVNamespace,
    FB_PIXEL_ID: 'fb-123',
    FB_ACCESS_TOKEN: 'fb-abc',
});

const createMockState = (overrides: Partial<PixelState> = {}): PixelState => ({
    internal_txn_id: 'test-txn-123',
    siteId: 'test-site', // Added default siteId
    timestamp_created: new Date().toISOString(),
    status: 'pending',
    trackingParams: { click_id: 'ef-click-xyz', affId: 'net1', c1: 'aff1', c2: 'offer1' },
    scrubDecision: { isScrub: false, targetCampaignId: '100' },
    processed_Initial: false,
    processed_Upsell_1: false,
    processed_Upsell_2: false,
    timestamp_processed_Initial: null,
    timestamp_processed_Upsell_1: null,
    ...overrides,
});

const createMockConfirmationData = (overrides: Partial<any> = {}): any => ({
    order_id: 'conf-123',
    total_amount: 50.00, // Keep as number for source data
    email: 'test@example.com',
    ...overrides,
});

// Use standard Request, cast later if needed by mocks/functions
const createMockRequest = (url = 'https://example.com/'): Request => {
    return new Request(url);
};

// Helper to create mock ExecutionContext
const createMockExecutionContext = (): ExecutionContext => {
    return {
        waitUntil: vi.fn((promise) => promise.catch(() => {})), // Execute promise immediately and catch potential rejections in mock
        passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext; // Use unknown cast for flexibility
};


// --- Action Definitions (using local type) ---
const mockScriptAction: ClientSideActionDefinition = {
    provider: 'custom',
    type: 'client-side',
    script_template: '<script>action1</script>',
};

const mockServerActionGet: ServerSideActionDefinition = {
    provider: 'custom',
    type: 'server-side',
    url: 'https://webhook.site/click?cid=PARAM:CLICK_ID&value=PARAM:ORDER_TOTAL',
    method: 'GET',
};

const mockServerActionPostJson: ServerSideActionDefinition = {
    provider: 'custom',
    type: 'server-side',
    url: 'https://webhook.site/click1',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'PARAM:API_KEY'
    },
    body_template: {
        orderId: 'PARAM:ORDER_ID',
        value: 'PARAM:ORDER_TOTAL', // Template uses placeholder
    },
};

const mockServerActionPostForm: ServerSideActionDefinition = {
    provider: 'custom',
    type: 'server-side',
    url: 'https://webhook.site/click2',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    },
    body_template: 'oid=PARAM:ORDER_ID&amt=PARAM:ORDER_TOTAL&cid=PARAM:CLICK_ID',
};

// Assuming FB CAPI is a server-side action based on src/actions.ts structure
const mockFbAction: ServerSideActionDefinition = {
    provider: 'facebook',
    type: 'server-side',
    url: `https://graph.facebook.com/v19.0/PARAM:FB_PIXEL_ID/events?access_token=PARAM:FB_ACCESS_TOKEN`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, // Headers exist but aren't a template
    body_template: {
        data: [{
            event_name: 'Purchase',
            event_time: 'PARAM:TIMESTAMP_UNIX',
            event_source_url: 'PARAM:PAGE_URL',
            user_data: {
                em: ['PARAM:USER_EMAIL_HASHED'],
                ph: ['PARAM:USER_PHONE_HASHED'],
                client_ip_address: 'PARAM:IP_ADDRESS',
                client_user_agent: 'PARAM:USER_AGENT',
                fbc: 'PARAM:FBC',
                fbp: 'PARAM:FBP',
            },
            custom_data: {
                value: 'PARAM:ORDER_TOTAL', // Template uses placeholder
                currency: 'USD',
                order_id: 'PARAM:ORDER_ID',
            },
        }],
    }
};


// --- Test Suite ---

describe('Action Triggers', () => {
    let env: Env;
    let state: PixelState;
    let confirmationData: any;
    let request: Request; // Use standard Request
    let context: ExecutionContext;
    let dataSources: TestDataSources; // Use local TestDataSources type

    beforeEach(() => {
        vi.clearAllMocks(); // Clear mocks before each test
        env = createMockEnv(); // Creates env with mocked put
        state = createMockState();
        confirmationData = createMockConfirmationData();
        request = createMockRequest(); // Create standard Request
        context = createMockExecutionContext();
        // Assign using the local TestDataSources type - no cast needed here
        dataSources = { state, confirmationData, request, env };

        // Mock KV get for state (consistent across most tests)
        (env.PIXEL_STATE.get as Mock).mockResolvedValue(JSON.stringify(state));

        // --- Default Mocks (can be overridden within specific tests) ---
        // Mock KV get for action lists and definitions
        (env.PIXEL_CONFIG.get as Mock).mockImplementation(async (key: string) => {
            // console.log(`Default PIXEL_CONFIG.get mock called with key: ${key}`); // Debugging line
            if (key === 'checkoutNormalActions') return JSON.stringify(['action1', 'action2']);
            if (key === 'upsell1NormalActions') return JSON.stringify(['action3', 'action4', 'fb1']);
            if (key === 'action:action1') return JSON.stringify(mockScriptAction);
            if (key === 'action:action2') return JSON.stringify(mockServerActionGet);
            if (key === 'action:action3') return JSON.stringify(mockServerActionPostJson);
            if (key === 'action:action4') return JSON.stringify(mockServerActionPostForm);
            if (key === 'action:fb1') return JSON.stringify(mockFbAction);
            // Keep null/bad json for specific tests, but they should override this default mock
            if (key === 'action:missingAction') return null;
            if (key === 'action:badJsonAction') return '{ bad json';
            if (key === 'payout_steps') return "1"; // Default payout step
            return null; // Default return for unhandled keys
        });

        // Reset fetch mock
        mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

        // --- Refined mockPopulateParameters ---
        // Update mock signature to accept TestDataSources
        mockPopulateParameters.mockImplementation(async (template: string | object, ds: TestDataSources) => {
            // Simple mock: prefix strings, stringify objects after basic replacement
            if (typeof template === 'string') {
                // Specific handling for script template
                if (template === '<script>action1</script>') {
                    return 'populated_script_template';
                }
                 // Specific handling for form body template
                if (template === 'oid=PARAM:ORDER_ID&amt=PARAM:ORDER_TOTAL&cid=PARAM:CLICK_ID') {
                    // Ensure total_amount is treated as string here for consistency
                    return `oid=${ds.confirmationData.order_id || 'mock_order_id'}&amt=${String(ds.confirmationData.total_amount || '0')}&cid=${ds.state.trackingParams.click_id || 'mock_click_id'}`;
                }
                // Generic string replacement for URLs etc.
                // Add FB params
                return template
                    .replace(/PARAM:CLICK_ID/g, ds.state.trackingParams.click_id || 'mock_click_id')
                    .replace(/PARAM:ORDER_TOTAL/g, String(ds.confirmationData.total_amount || '0')) // Ensure string conversion
                    .replace(/PARAM:ORDER_ID/g, ds.confirmationData.order_id || 'mock_order_id')
                    .replace(/PARAM:API_KEY/g, 'populated_API_KEY')
                    .replace(/PARAM:FB_PIXEL_ID/g, ds.env.FB_PIXEL_ID || 'mock_fb_id')
                    .replace(/PARAM:FB_ACCESS_TOKEN/g, ds.env.FB_ACCESS_TOKEN || 'mock_fb_token');
            } else if (typeof template === 'object' && template !== null) {
                // Simulate population for objects (headers, body, event_data, user_data)
                // Deep copy to avoid modifying the template object directly
                let populated = JSON.parse(JSON.stringify(template));

                // Recursive population simulation (simplified) - Updated to handle objects in arrays
                const populateObj = (obj: any) => {
                    for (const key in obj) {
                        if (typeof obj[key] === 'string') {
                            // Apply replacements to string properties
                            obj[key] = obj[key]
                                .replace(/PARAM:CLICK_ID/g, ds.state.trackingParams.click_id || 'mock_click_id')
                                .replace(/PARAM:ORDER_TOTAL/g, String(ds.confirmationData.total_amount || '0')) // Ensure string conversion
                                .replace(/PARAM:ORDER_ID/g, ds.confirmationData.order_id || 'mock_order_id')
                                .replace(/PARAM:API_KEY/g, 'populated_API_KEY')
                                .replace(/PARAM:TIMESTAMP_UNIX/g, String(Math.floor(Date.now() / 1000)))
                                .replace(/PARAM:PAGE_URL/g, ds.request.url) // Use standard request.url
                                .replace(/PARAM:USER_EMAIL_HASHED/g, 'mock_email_hash')
                                .replace(/PARAM:USER_PHONE_HASHED/g, 'mock_phone_hash')
                                .replace(/PARAM:IP_ADDRESS/g, '1.2.3.4')
                                .replace(/PARAM:USER_AGENT/g, 'TestAgent')
                                .replace(/PARAM:FBC/g, ds.state.trackingParams.fbc || 'mock_fbc')
                                .replace(/PARAM:FBP/g, ds.state.trackingParams.fbp || 'mock_fbp')
                                .replace(/PARAM:FB_TEST_CODE/g, ds.env.FB_TEST_CODE || ''); // Handle optional test code
                        } else if (Array.isArray(obj[key])) {
                            // If property is an array, map over its items
                            obj[key] = obj[key].map((item: any) => {
                                if (typeof item === 'string') {
                                    // Apply replacements to string items in array (e.g., user_data.em)
                                    return item
                                        .replace(/PARAM:USER_EMAIL_HASHED/g, 'mock_email_hash')
                                        .replace(/PARAM:USER_PHONE_HASHED/g, 'mock_phone_hash');
                                } else if (typeof item === 'object' && item !== null) {
                                    // *** If item is an object, recurse into it ***
                                    populateObj(item);
                                    return item; // Return the modified object
                                }
                                return item; // Return non-string/non-object items unchanged
                            });
                        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                            // If property is a non-array object, recurse into it
                            populateObj(obj[key]);
                        }
                    }
                };


                populateObj(populated);

                // Remove empty optional fields like test_event_code if necessary (mimic real function)
                 if (populated.data && populated.data[0] && populated.data[0].test_event_code === '') {
                     delete populated.data[0].test_event_code;
                 }
                 if (populated.test_event_code === '') {
                     delete populated.test_event_code;
                 }


                return populated; // Return the populated object
            }
            return template; // Return unchanged otherwise
        });
    });

    describe('triggerInitialActions', () => {
        it('should retrieve and process initial actions, executing server actions', async () => {
            // Uses default beforeEach mocks
            const result = await triggerInitialActions(state.internal_txn_id, confirmationData, env, context, request as unknown as CfRequest);

            // Verify KV calls
            expect(env.PIXEL_STATE.get).toHaveBeenCalledWith(`txn_${state.internal_txn_id}`);
            expect(env.PIXEL_CONFIG.get).toHaveBeenCalledWith('checkoutNormalActions');
            expect(env.PIXEL_CONFIG.get).toHaveBeenCalledWith('action:action1');
            expect(env.PIXEL_CONFIG.get).toHaveBeenCalledWith('action:action2');
            expect(env.PIXEL_STATE.put).toHaveBeenCalled(); // Check state update

            // Verify populateParameters calls (using the local dataSources object)
            expect(mockPopulateParameters).toHaveBeenCalledTimes(2); // Once for script, once for URL
            expect(mockPopulateParameters).toHaveBeenCalledWith(mockScriptAction.script_template, dataSources);
            expect(mockPopulateParameters).toHaveBeenCalledWith(mockServerActionGet.url, dataSources);

            // Verify client-side actions result
            expect(result.clientSideActions).toHaveLength(1);
            expect(result.clientSideActions[0]).toBe('populated_script_template');

            // Verify server-side fetch call (GET)
            expect(mockFetch).toHaveBeenCalledTimes(1);
            // Expect string value in URL due to mockPopulateParameters logic
            const expectedUrl = `https://webhook.site/click?cid=${state.trackingParams.click_id}&value=${String(confirmationData.total_amount)}`;
            expect(mockFetch).toHaveBeenCalledWith(expectedUrl, { method: 'GET', headers: undefined });

            // Verify context.waitUntil was called for state update and server actions
            expect(context.waitUntil).toHaveBeenCalledTimes(2); // Once for state put, once for server actions Promise.allSettled
        });

        it('should handle missing action definitions gracefully', async () => {
            // Override PIXEL_CONFIG.get for this specific test
            (env.PIXEL_CONFIG.get as Mock).mockImplementation(async (key: string) => {
                if (key === 'checkoutNormalActions') return JSON.stringify(['action1', 'missingAction']);
                if (key === 'action:action1') return JSON.stringify(mockScriptAction);
                if (key === 'action:missingAction') return null; // Explicitly return null
                if (key === 'payout_steps') return "1";
                return null; // Default for others
            });

            const result = await triggerInitialActions(state.internal_txn_id, confirmationData, env, context, request as unknown as CfRequest);

            // Check that the error for the missing definition was logged
            expect(consoleErrorSpy).toHaveBeenCalledWith('triggerInitialActions: Action definition not found', { internal_txn_id: state.internal_txn_id, actionKey: 'missingAction' });
            expect(mockPopulateParameters).toHaveBeenCalledTimes(1); // Only called for action1
            expect(mockPopulateParameters).toHaveBeenCalledWith(mockScriptAction.script_template, dataSources);
            expect(result.clientSideActions).toHaveLength(1);
            expect(result.clientSideActions[0]).toBe('populated_script_template');
            expect(mockFetch).not.toHaveBeenCalled(); // No server action executed for missing action
        });

        it('should handle JSON parsing errors for action definitions', async () => {
             // Override PIXEL_CONFIG.get for this specific test
            (env.PIXEL_CONFIG.get as Mock).mockImplementation(async (key: string) => {
                if (key === 'checkoutNormalActions') return JSON.stringify(['action1', 'badJsonAction']);
                if (key === 'action:action1') return JSON.stringify(mockScriptAction);
                if (key === 'action:badJsonAction') return '{ bad json'; // Bad JSON
                if (key === 'payout_steps') return "1";
                return null;
            });

            const result = await triggerInitialActions(state.internal_txn_id, confirmationData, env, context, request as unknown as CfRequest);

            // Update assertion to match the actual error object logged
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'triggerInitialActions: Unhandled error',
                expect.objectContaining({
                    internal_txn_id: state.internal_txn_id,
                    errorMessage: expect.stringContaining('Expected property name or \'}\' in JSON'), // More specific error message
                    stack: expect.any(String)
                })
            );
            expect(result.clientSideActions).toHaveLength(0); // Error likely prevents actions
            expect(mockFetch).not.toHaveBeenCalled();
        });

         it('should handle errors during parameter population', async () => {
            // Uses default beforeEach mock for PIXEL_CONFIG.get
            const populationError = new Error('Population failed!');
            mockPopulateParameters
                .mockResolvedValueOnce('populated_script_template') // action1 script succeeds
                .mockRejectedValueOnce(populationError); // action2 URL population fails

            const result = await triggerInitialActions(state.internal_txn_id, confirmationData, env, context, request as unknown as CfRequest);

            // Check the specific error log for parameter population failure
            expect(consoleErrorSpy).toHaveBeenCalledWith('triggerInitialActions: Parameter population error', {
                 internal_txn_id: state.internal_txn_id,
                 actionKey: 'action2',
                 errorMessage: populationError.message,
             });
            expect(result.clientSideActions).toHaveLength(1); // action1 still processed
            expect(mockFetch).not.toHaveBeenCalled(); // action2 failed before fetch
        });

         it('should not run if state already processed', async () => {
            // Uses default beforeEach mock for PIXEL_CONFIG.get
            const processedState = createMockState({ processed_Initial: true });
            (env.PIXEL_STATE.get as Mock).mockResolvedValue(JSON.stringify(processedState)); // Override state get

            const result = await triggerInitialActions(processedState.internal_txn_id, confirmationData, env, context, request as unknown as CfRequest);

            expect(consoleLogSpy).toHaveBeenCalledWith(`triggerInitialActions: Already processed for ${processedState.internal_txn_id}`);
            expect(env.PIXEL_CONFIG.get).not.toHaveBeenCalledWith('checkoutNormalActions');
            expect(mockPopulateParameters).not.toHaveBeenCalled();
            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.clientSideActions).toHaveLength(0);
        });

         it('should not run if payout step prevents it', async () => {
             // Override PIXEL_CONFIG.get for this specific test
            (env.PIXEL_CONFIG.get as Mock).mockImplementation(async (key: string) => {
                 if (key === 'payout_steps') return "0"; // Payout step 0
                 return null;
            });

            const result = await triggerInitialActions(state.internal_txn_id, confirmationData, env, context, request as unknown as CfRequest);

            expect(consoleLogSpy).toHaveBeenCalledWith(`triggerInitialActions: Payout step (0) prevents initial actions for ${state.internal_txn_id}`);
            expect(env.PIXEL_CONFIG.get).toHaveBeenCalledWith('payout_steps'); // Verify payout_steps was checked
            expect(env.PIXEL_CONFIG.get).not.toHaveBeenCalledWith('checkoutNormalActions');
            expect(mockPopulateParameters).not.toHaveBeenCalled();
            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.clientSideActions).toHaveLength(0);
        });
    });

    // Renamed describe block
    describe('triggerUpsellActions', () => {
        const upsellStepNum = 1;
        const upsellActionListKey = `upsell${upsellStepNum}NormalActions`;

        // Test adapted from 'should retrieve and process confirmation actions'
        it('should retrieve and process upsell actions, executing server actions', async () => {
            // Uses default beforeEach mocks which include all upsell actions
            const result = await triggerUpsellActions(state.internal_txn_id, upsellStepNum, confirmationData, env, context, request as unknown as CfRequest);

            // Verify KV calls
            expect(env.PIXEL_STATE.get).toHaveBeenCalledWith(`txn_${state.internal_txn_id}`);
            expect(env.PIXEL_CONFIG.get).toHaveBeenCalledWith(upsellActionListKey);
            expect(env.PIXEL_CONFIG.get).toHaveBeenCalledWith('action:action3');
            expect(env.PIXEL_CONFIG.get).toHaveBeenCalledWith('action:action4');
            expect(env.PIXEL_CONFIG.get).toHaveBeenCalledWith('action:fb1');
            expect(env.PIXEL_STATE.put).toHaveBeenCalled(); // Check state update

            // Verify populateParameters calls
            // Expect 9 calls: url(3), headers(3), body(3)
            expect(mockPopulateParameters).toHaveBeenCalledTimes(9); // Updated expectation
            // Check calls for action3 (POST JSON)
            expect(mockPopulateParameters).toHaveBeenCalledWith(mockServerActionPostJson.url, dataSources);
            expect(mockPopulateParameters).toHaveBeenCalledWith(mockServerActionPostJson.headers, dataSources);
            expect(mockPopulateParameters).toHaveBeenCalledWith(mockServerActionPostJson.body_template, dataSources);
             // Check calls for action4 (POST Form)
            expect(mockPopulateParameters).toHaveBeenCalledWith(mockServerActionPostForm.url, dataSources);
            expect(mockPopulateParameters).toHaveBeenCalledWith(mockServerActionPostForm.headers, dataSources);
            expect(mockPopulateParameters).toHaveBeenCalledWith(mockServerActionPostForm.body_template, dataSources);
             // Check calls for fb1 (FB CAPI)
            expect(mockPopulateParameters).toHaveBeenCalledWith(mockFbAction.url, dataSources); // URL
            expect(mockPopulateParameters).toHaveBeenCalledWith(mockFbAction.headers, dataSources); // Headers (called even if not template)
            expect(mockPopulateParameters).toHaveBeenCalledWith(mockFbAction.body_template, dataSources); // Body


            expect(result.clientSideActions).toHaveLength(0); // No client actions defined for upsell in mocks

            // Verify server-side fetch calls
            expect(mockFetch).toHaveBeenCalledTimes(3); // action3, action4, fb1

            // Verify action3 fetch call (expect string value)
            const expectedUrl3 = 'https://webhook.site/click1';
            const expectedOptions3 = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-Key': 'populated_API_KEY' },
                body: JSON.stringify({ orderId: 'conf-123', value: String(confirmationData.total_amount) }), // Expect string
            };
            expect(mockFetch).toHaveBeenCalledWith(expectedUrl3, expectedOptions3);

            // Verify action4 fetch call (expect string value)
            const expectedUrl4 = 'https://webhook.site/click2';
            const expectedOptions4 = {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `oid=conf-123&amt=${String(confirmationData.total_amount)}&cid=ef-click-xyz`, // Expect string
            };
            expect(mockFetch).toHaveBeenCalledWith(expectedUrl4, expectedOptions4);

             // Verify fb1 fetch call (basic check based on mock)
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining(`graph.facebook.com/v19.0/${env.FB_PIXEL_ID}/events`),
                expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } })
            );
            // More specific check for fb1 body value (expect string) - Now uses updated mockPopulateParameters
            const fbCall = mockFetch.mock.calls.find(call => call[0].includes('graph.facebook.com'));
            expect(fbCall).toBeDefined();
            if (fbCall) {
                const fbOptions = fbCall[1];
                const bodyData = JSON.parse(fbOptions.body as string);
                expect(bodyData.data[0].custom_data.value).toBe(String(confirmationData.total_amount)); // Expect string
            }


            // Verify context.waitUntil
            expect(context.waitUntil).toHaveBeenCalledTimes(2); // State put, Server actions
        });

        // Test adapted from 'should process server-side actions correctly (POST with JSON body)'
        it('should execute server-side actions correctly (POST with JSON body)', async () => {
            const actionKey = 'action3';
            // Override PIXEL_CONFIG.get for this specific test
            (env.PIXEL_CONFIG.get as Mock).mockImplementation(async (key: string) => {
                if (key === upsellActionListKey) return JSON.stringify([actionKey]); // Only this action
                if (key === `action:${actionKey}`) return JSON.stringify(mockServerActionPostJson);
                return null;
            });

            await triggerUpsellActions(state.internal_txn_id, upsellStepNum, confirmationData, env, context, request as unknown as CfRequest);

            // Verify fetch call
            expect(mockFetch).toHaveBeenCalledTimes(1); // Should only be called once now
            expect(mockFetch).toHaveBeenCalledWith('https://webhook.site/click1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-Key': 'populated_API_KEY' },
                body: JSON.stringify({ orderId: 'conf-123', value: String(confirmationData.total_amount) }), // Expect string value
            });
            // Verify populate calls for only action3
            expect(mockPopulateParameters).toHaveBeenCalledTimes(3); // url, headers, body
        });

        // Test adapted from 'should process server-side actions correctly (POST with form body)'
        it('should execute server-side actions correctly (POST with form body)', async () => {
             const actionKey = 'action4';
            // Override PIXEL_CONFIG.get for this specific test
            (env.PIXEL_CONFIG.get as Mock).mockImplementation(async (key: string) => {
                if (key === upsellActionListKey) return JSON.stringify([actionKey]); // Only this action
                if (key === `action:${actionKey}`) return JSON.stringify(mockServerActionPostForm);
                return null;
            });

            await triggerUpsellActions(state.internal_txn_id, upsellStepNum, confirmationData, env, context, request as unknown as CfRequest);

            // Verify fetch call
            expect(mockFetch).toHaveBeenCalledTimes(1); // Should only be called once now
            expect(mockFetch).toHaveBeenCalledWith('https://webhook.site/click2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `oid=conf-123&amt=${String(confirmationData.total_amount)}&cid=ef-click-xyz`, // Expect string value
            });
             // Verify populate calls for only action4
            expect(mockPopulateParameters).toHaveBeenCalledTimes(3); // url, headers, body
        });

        // Test adapted from 'should handle FB CAPI actions'
         it('should execute FB CAPI actions', async () => {
             const actionKey = 'fb1';
            // Override PIXEL_CONFIG.get for this specific test
            (env.PIXEL_CONFIG.get as Mock).mockImplementation(async (key: string) => {
                if (key === upsellActionListKey) return JSON.stringify([actionKey]); // Only this action
                if (key === `action:${actionKey}`) return JSON.stringify(mockFbAction);
                return null;
            });

            await triggerUpsellActions(state.internal_txn_id, upsellStepNum, confirmationData, env, context, request as unknown as CfRequest);

            expect(mockFetch).toHaveBeenCalledTimes(1); // Should only be called once now
            const fbCall = mockFetch.mock.calls[0];
            const fbUrl = fbCall[0];
            const fbOptions = fbCall[1];

            expect(fbUrl).toContain(`graph.facebook.com/v19.0/${env.FB_PIXEL_ID}/events`);
            expect(fbUrl).toContain(`access_token=${env.FB_ACCESS_TOKEN}`);
            expect(fbOptions.method).toBe('POST');
            expect(fbOptions.headers).toEqual({ 'Content-Type': 'application/json' });
            expect(fbOptions.body).toBeDefined();
            const bodyData = JSON.parse(fbOptions.body as string);
            expect(bodyData.data[0].event_name).toBe('Purchase');
            expect(bodyData.data[0].custom_data.value).toBe(String(confirmationData.total_amount)); // Expect string value - Now uses updated mockPopulateParameters

            // Verify populate calls for only fb1
            expect(mockPopulateParameters).toHaveBeenCalledTimes(3); // url, headers, body - Updated expectation
        });

         it('should not run if state already processed for this upsell step', async () => {
            // Uses default beforeEach mock for PIXEL_CONFIG.get
            const processedState = createMockState({ processed_Upsell_1: true });
            (env.PIXEL_STATE.get as Mock).mockResolvedValue(JSON.stringify(processedState)); // Override state get

            const result = await triggerUpsellActions(processedState.internal_txn_id, upsellStepNum, confirmationData, env, context, request as unknown as CfRequest);

            expect(consoleLogSpy).toHaveBeenCalledWith(`triggerUpsellActions: Step ${upsellStepNum} already processed for ${processedState.internal_txn_id}`);
            expect(env.PIXEL_CONFIG.get).not.toHaveBeenCalledWith(upsellActionListKey);
            expect(mockPopulateParameters).not.toHaveBeenCalled();
            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.clientSideActions).toHaveLength(0);
        });
    });
});