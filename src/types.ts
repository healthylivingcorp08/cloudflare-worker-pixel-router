import type { KVNamespace, DurableObjectNamespace, Request as CfRequest, RateLimit } from '@cloudflare/workers-types';

export interface Env {
    // KV Namespaces
    PIXEL_STATE: KVNamespace; // Stores transaction-specific state
    PIXEL_CONFIG: KVNamespace; // Stores site configurations, action definitions, rules

    // Durable Objects
    // RATE_LIMITER: DurableObjectNamespace; // Example if using DO for rate limiting

    // Secrets / Environment Variables
    STICKY_USERNAME?: string;
    STICKY_PASSWORD?: string;
    STICKY_API_URL?: string; // Default Sticky API URL
    WORKER_BASE_URL?: string; // Base URL of the worker itself
    // Add other secrets as needed, e.g., API keys for third-party services

    // Bindings for other services (e.g., Queues, D1)
    // MY_QUEUE: Queue;
    // MY_D1_DB: D1Database;
    API_RATE_LIMITER: RateLimit; // Added for Worker Rate Limiting

    // Variables for testing/local development
    IS_LOCAL?: boolean | string; // Flag for local development specific logic
}

export interface CustomerAddress {
    street?: string;
    street2?: string; // Added street2
    city?: string;
    state?: string; // Province/Region for non-US
    zip?: string;   // Postal code
    country?: string; // ISO 3166-1 alpha-2 code (e.g., "US", "CA", "GB")
}

export interface PixelState {
    // Core transaction details
    internal_txn_id: string; // Unique ID for this transaction journey
    status: 'pending' | 'processed' | 'failed' | 'upsell_attempted' | 'upsell_processed' | 'error' | 'paypal_redirect' | 'paypal_upsell_completed'; // Status of the transaction
    timestamp_created: string; // ISO 8601 timestamp
    timestamp_last_updated: string; // ISO 8601 timestamp
    siteId?: string; // Identifier for the site/funnel this transaction belongs to
initialUrl?: string; // Full URL of the page where the transaction journey started (e.g., from Referer)
    siteBaseUrl?: string; // Base URL of the site, e.g., https://www.example.com

    // Customer details (populated from initial checkout)
    customerFirstName?: string;
    customerLastName?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerAddress?: CustomerAddress; // Billing address
    customerShippingAddress?: CustomerAddress; // Shipping address, added

    // Payment and Order details
    paymentMethod_initial?: 'card' | 'paypal' | 'other'; // Initial payment method chosen
    stickyOrderId_initial?: string; // Sticky.io order ID from the initial transaction
    stickyOrderId?: string; // Current or most recent Sticky.io order ID (can be same as initial or from an upsell)
    confirmedStickyOrderId?: string; // Order ID confirmed from order_view
    gatewayId?: string | number; // Sticky.io gateway ID used for the transaction
    
    // PayPal specific details
    paypalTransactionId?: string; // PayPal's transaction ID (e.g., from transactionID URL param)
    paypalPayerId?: string; // PayPal PayerID
    stickyOrderIdFromPaypalReturn?: string; // order_id passed by Sticky in PayPal return URL
    gatewayIdFromPaypalReturn?: string | number; // gateway_id passed by Sticky in PayPal return URL

    // Action processing flags
    processedInitial?: boolean; // True if initial checkout actions have been processed
    processed_Upsell_1?: boolean; // True if upsell step 1 actions processed
    processed_Upsell_2?: boolean; // True if upsell step 2 actions processed
    processed_Upsell_3?: boolean; // True if upsell step 3 actions processed
    // Add more processed_Upsell_N flags as needed

    // Optional: Store specific order IDs and timestamps for each upsell step
    stickyOrderId_Upsell1?: string;
    timestamp_processed_Upsell_1?: string;
    stickyOrderId_Upsell2?: string;
    timestamp_processed_Upsell_2?: string;
    stickyOrderId_Upsell3?: string;
    timestamp_processed_Upsell_3?: string;

    // Optional: Store original request details if needed for retries or context
    originalRequestId?: string; // e.g., from CF-Request-ID header
    originalRequestUrl?: string;
    originalReferrer?: string;

    // Optional: Store error details
    lastError?: {
        timestamp: string;
        message: string;
        handler?: string; // e.g., 'checkout', 'paypalReturn', 'upsell'
    };

    // Optional: Data for specific integrations or rules
    affid?: string; // Affiliate ID from request
    campaignId?: string | number; // Campaign ID from request or state
    scrubDecision?: { // Example if scrub logic is implemented
        isScrub: boolean;
        reason?: string;
        targetCampaignId: string; // Added to store the chosen campaign ID
    };

    // Add any other dynamic fields as needed, consider using a more flexible structure if many dynamic fields
    [key: string]: any; // Allows for dynamic properties like timestamp_processed_Upsell_N
}


export interface CheckoutRequestBillingAddress {
    firstName: string;
    lastName:string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    country: string;
    zip: string;
    phone: string;
    email: string;
}

export interface CheckoutRequestShippingAddress extends Omit<CheckoutRequestBillingAddress, 'email' | 'phone'> {
    // Shipping might not need email/phone, or might have its own
}

export interface CheckoutRequestOfferItem {
    offer_id: string | number;
    product_id: string | number;
    billing_model_id: string | number;
    quantity: number;
    // trial?: {
    //     enabled: boolean;
    //     length?: number; // e.g. 14 (days)
    //     price?: number; // e.g. 0 or a specific trial price
    // }
}

export interface CheckoutRequestPayload {
    // Site and transaction identifiers
    siteId: string; // e.g., "drivebright", "alphafuel"
    sticky_url_id: string; // Identifier for STICKY_URL_MAP
    internal_txn_id?: string; // Optional: if provided, attempt to resume this transaction

    // Customer and Billing Information
    customer: CheckoutRequestBillingAddress;
    shippingAddress?: CheckoutRequestShippingAddress; // Optional, if different from billing

    // Payment Details
    paymentMethod: 'card' | 'paypal'; // Add other methods like 'googlepay', 'applepay' as needed
    creditCard?: { // Required if paymentMethod is 'card'
        number: string;
        cvv: string;
        expiryMonth: string; // MM
        expiryYear: string;  // YYYY
    };
    // For PayPal, specific fields like paypal_token might be added later or handled by redirect

    // Order Details
    offers: CheckoutRequestOfferItem[];
    shippingId: string | number; // Sticky.io shipping ID
    campaignId: string | number; // Sticky.io campaign ID
    ipAddress: string;
    
    // Optional parameters for Sticky.io or internal logic
    forceGatewayId?: string | number; // To force a specific gateway
    preserve_force_gateway?: "0" | "1";
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
    affid?: string;
    click_id?: string;
    subid1?: string;
    subid2?: string;
    subid3?: string;
    subid4?: string;
    subid5?: string;
    notes?: string; // Order notes for Sticky.io
    siteBaseUrl?: string; // e.g. https://www.example.com, for constructing return URLs
}

// Represents the structure of credit card details, often nested within other payloads
export interface PaymentData {
    number: string;
    cvv: string;
    expiryMonth: string; // MM
    expiryYear: string;  // YYYY or YY depending on source
    // cardholderName?: string; // Optional, if collected
    // type?: string; // Optional, e.g., 'visa', 'mastercard' if known
}

export interface UpsellOfferItem {
    product_id: string | number;
    billing_model_id: string | number;
    quantity: number;
    // campaign_id?: string | number; // Sometimes campaign can be per offer
    // shipping_profile_id?: string | number; // If shipping changes per upsell
}

export interface UpsellRequest {
    siteId: string;
    sticky_url_id?: string; // Identifier for STICKY_URL_MAP, made optional
    step: number; // e.g., 1 for upsell1, 2 for upsell2
    upsellType: 'accept' | 'decline' | 'skip'; // Action taken by user
    offers: UpsellOfferItem[]; // Products being accepted in this upsell step
    shippingId: string | number; // Sticky.io shipping ID for this upsell
    campaignId: string | number; // Sticky.io campaign ID for this upsell
    
    // Optional, for card upsells or if forcing gateway
    forceGatewayId?: string | number;
    preserve_gateway?: "0" | "1";
    siteBaseUrl?: string; // e.g. https://www.example.com, for constructing return URLs for PayPal upsells
}

// Generic Sticky.io API Response structure (adapt as needed)
export interface StickyPayload {
    success?: boolean; // Custom flag, not from Sticky
    _ok?: boolean; // From fetch response.ok
    _status?: number; // From fetch response.status
    _rawBody?: string; // Raw response body if JSON parsing fails or for HTML
    
    // Common Sticky.io fields (actual fields vary by endpoint)
    response_code?: number | string; // e.g., 100 for success
    order_id?: string;
    decline_reason?: string;
    error_message?: string; // More generic error message
    gateway_id?: string | number;
    
    // For new_order with alt_pay like PayPal, might get a redirect URL
    gateway_response?: {
        redirect_url?: string;
        [key: string]: any; // Other gateway specific data
    };
    
    // For order_view
    data?: Array<{
        order_id?: string;
        order_status?: 'pending' | 'approved' | 'declined' | 'partial' | 'voided' | 'refunded' | 'chargeback' | 'error' | 'cancelled';
        [key: string]: any;
    }>;

    // Allow any other fields
    [key: string]: any;
}

export interface OrderDetailsRequest {
    siteId: string;
    sticky_url_id: string;
    orderId: string; // The Sticky.io order ID to view
}

// Structure for the response from /api/order_details endpoint
export interface OrderDetailsResponse {
    success: boolean;
    message?: string;
    order?: { // Simplified structure, expand as needed
        orderId: string;
        status: string;
        customer: {
            firstName?: string;
            lastName?: string;
            email?: string;
            phone?: string;
            shippingAddress?: CustomerAddress;
            billingAddress?: CustomerAddress;
        };
        products: Array<{
            name?: string;
            sku?: string;
            quantity?: number;
            price?: number;
        }>;
        totals: {
            subtotal?: number;
            shipping?: number;
            tax?: number;
            discount?: number;
            total?: number;
        };
        payment: {
            method?: string; // e.g., "Credit Card", "PayPal"
            cardLastFour?: string;
            cardType?: string; // e.g., "Visa"
        };
        gatewayId?: string | number;
        // Add more fields as returned by Sticky.io order_view and processed by your handler
    };
}

// For Cloudflare Request object augmentation if needed
export interface CfRequestWithExtras extends CfRequest {
    // Example: add parsed body or other properties middleware might add
    // parsedBody?: any; 
}