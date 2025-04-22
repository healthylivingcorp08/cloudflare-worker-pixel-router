import type { KVNamespace } from '@cloudflare/workers-types';

// Pixel Types
export type PixelType = 'everflow_click' | 'everflow_conversion' | 'normal' | 'scrub';

// Parameter Mapping Types
export interface ParameterMapping {
  [pixelParam: string]: string; // Maps pixel parameter names to URL parameter names
}

// Pixel Configuration
export interface PixelConfig {
  type: PixelType;
  config: {
    offer_id?: string;
    affiliate_id?: string;
    parameterMapping?: ParameterMapping;
    [key: string]: any; // Other configuration options
  };
}

// API Endpoint Configuration
export interface ApiEndpointConfig {
  type: string;
  endpoint: string;
  method: string;
  config: {
    campaign_id?: string;
    product_id?: string;
    api_key?: string;
    [key: string]: any; // Other API-specific configuration
  };
}

// Page Configuration
export interface PageConfig {
  pixels: PixelConfig[];
  apiEndpoints: ApiEndpointConfig[];
}

// Site Configuration
export interface SiteConfig {
  scrubPercent: number;
  siteId: string;
  normal_campaign_id: string; // Added: Default campaign ID for the site
  scrub_campaign_id: string;  // Added: Campaign ID to use when scrubbing
  payout_step?: number; // 1: Single Payout (default), 2: Multiple Payouts (incl. upsells)
  pages: {
    [pageName: string]: PageConfig;
  };
}

// Sites Configuration
export interface SitesConfig {
  [site: string]: SiteConfig;
}

// Conversion Data
export interface ConversionData {
  site: string;
  page: string;
  pixelType: PixelType;
  [key: string]: any; // Other order/conversion fields
}

// Pixel Route Result
export interface PixelRouteResult {
  pixels: PixelConfig[];
  apiEndpoints: ApiEndpointConfig[];
  shouldScrub: boolean;
}

// URL Context (for parameter resolution)
export interface UrlContext {
  params: { [key: string]: string };
  path: string;
  hostname: string;
}

// Value Resolution Context
export interface ResolutionContext {
  url: UrlContext;
  kv: KVNamespace;
  secrets: { [key: string]: string };
}

// Cloudflare Worker environment type for KV and Secret bindings
export interface Env {
  PIXEL_CONFIG: KVNamespace; // KV Binding for rules/actions
  PIXEL_STATE: KVNamespace;  // KV Binding for transaction state

  // Secrets for Sticky.io API
  STICKY_API_URL: string;      // Worker Secret binding
  STICKY_USERNAME: string;     // Worker Secret binding (production name)
  STICKY_PASSWORD: string;     // Worker Secret binding (production name)

  // Secrets for Admin Auth (Example)
  ADMIN_USERNAME?: string; // Optional secret
  ADMIN_PASSWORD?: string; // Optional secret

  JWT_SECRET: string;       // Secret for signing/verifying admin JWTs

  // Secret for Encryption
  ENCRYPTION_SECRET?: string; // Added for encryption/decryption

  // KV Namespace for Admin UI Assets (JS, CSS)
  ADMIN_UI_ASSETS: KVNamespace;

  // Flag for enabling Next.js dev server proxy
  ADMIN_DEV_PROXY?: string; // Should be 'true' or 'false'/'undefined'

  // Secrets for Facebook CAPI (Optional)
  FB_PIXEL_ID?: string;
  FB_ACCESS_TOKEN?: string;
  FB_TEST_CODE?: string; // Optional test event code

  // Other secrets can be added here
}
// Simple Key-Value Pair type for Admin UI
export interface KVPair {
  key: string;
  value: string;
}

// KV State for Pixel Transactions (Based on kv_pixel_fires_checkout_plan.md Section 3)
export interface PixelState {
  internal_txn_id: string;
  timestamp_created: string; // ISO 8601 format
  status: 'pending' | 'paypal_redirect' | 'success' | 'failed';
  trackingParams: {
    affId?: string;
    c1?: string;
    c2?: string;
    sub1?: string;
    sub2?: string;
    sub3?: string;
    sub4?: string;
    sub5?: string;
    uid?: string;
    source_id?: string;
    click_id?: string; // Everflow transaction_id
    campaignId?: string; // Original campaignId before scrub/remap
    fbc?: string;
    fbp?: string;
    [key: string]: any; // Allow other tracking params
  };
  scrubDecision: {
    isScrub: boolean;
    targetCampaignId: string;
  };
  stickyOrderId_Initial?: string | null;
  stickyOrderId_Upsell1?: string | null;
  stickyOrderId_Upsell2?: string | null;
  // Add more upsell order IDs if needed
  paymentMethod_Initial?: 'card' | 'paypal' | null;
  processed_Initial: boolean;
  processed_Upsell_1?: boolean;
  processed_Upsell_2?: boolean;
  // Add more upsell processed flags if needed
  timestamp_processed_Initial?: string | null; // ISO 8601 format
  timestamp_processed_Upsell_1?: string | null; // ISO 8601 format
  // Add more timestamps if needed
}
// --- Data Structures from Original index.ts ---

// Structure for encrypted data (used in encryption utils and payment data)
export interface EncryptedData {
  iv: string;
  ciphertext: string;
}

// Structure for payment details, including potential encrypted fields
export interface PaymentData {
  cardType?: string;
  // Encrypted fields (optional, will be deleted after decryption)
  encryptedCard?: string | EncryptedData; // Allow both string (old format?) and object
  encryptedExpiry?: string | EncryptedData;
  encryptedCvv?: string | EncryptedData;
  // Decrypted fields (optional, added after decryption)
  creditCardNumber?: string;
  expirationDate?: string; // Should be MMYY format for Sticky
  CVV?: string;
  // PayPal specific
  paymentType?: 'paypal';
}

// Structure for the payload sent to Sticky.io API
export interface StickyPayload {
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
  billingSameAsShipping?: string; // 'YES' or 'NO'
  tranType?: string; // e.g., 'Sale'
  ipAddress?: string;
  campaignId?: string;
  offers?: any[]; // Define more specific type if possible
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
  previousOrderId?: string; // For upsells
}

// Structure for address details
export interface Address {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    country: string;
    zip: string;
}

// Structure for product details in an order
export interface Product {
    product_name: string;
    quantity: number;
    unitPrice: number;
    regPrice?: number;
    imageUrl?: string;
}

// Structure for order confirmation data (potentially returned from Sticky or constructed)
export interface OrderConfirmation {
    orderNumbers: string; // Or string[] if multiple orders possible
    firstName: string;
    lastName: string;
    shippingAddress: Address;
    products: Product[];
    shippingFee: number;
    creditCardType?: string;
}