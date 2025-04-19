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

  // Secrets for Sticky.io API
  STICKY_API_URL: string;      // Worker Secret binding
  STICKY_USERNAME: string;     // Worker Secret binding (production name)
  STICKY_PASSWORD: string;     // Worker Secret binding (production name)

  // Secrets for Admin Auth (Example)
  ADMIN_USERNAME?: string; // Optional secret
  ADMIN_PASSWORD?: string; // Optional secret

  // Secret for Encryption
  ENCRYPTION_SECRET?: string; // Added for encryption/decryption

  // Other secrets can be added here
}