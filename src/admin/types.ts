// Admin Role Types
export type UserRole = 'viewer' | 'pixel_manager' | 'admin';

// JWT Claims structure from Cloudflare Access
export interface JWTClaims {
  aud: string[];
  email: string;
  exp: number;
  iat: number;
  nbf: number;
  iss: string;
  type: string;
  identity_nonce: string;
  sub: string;
  country: string;
  // Custom claim for role
  custom: {
    role: UserRole;
  };
}

// Request with parsed JWT claims
export interface AuthenticatedRequest extends Request {
  jwt: JWTClaims;
}

// Admin API Response type
export interface AdminApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Site Configuration Types
export interface SiteConfigMetadata {
  lastModified: string;
  modifiedBy: string;
  version: number;
}

export interface KVKeyInfo {
  name: string;
  site: string;
  type: string;
  metadata?: any;
  allowedRoles: UserRole[];
}

// Pixel Types
export interface PixelConfig {
  type: string;
  config: {
    offer_id?: string;
    affiliate_id?: string;
    parameterMapping?: Record<string, string>;
    [key: string]: any;
  };
}

// API Endpoint Types
export interface ApiEndpointConfig {
  type: string;
  endpoint: string;
  method: string;
  config: {
    campaign_id?: string;
    product_id?: string;
    api_key?: string;
    [key: string]: any;
  };
}

// Page Configuration
export interface PageConfig {
  pixels: PixelConfig[];
  apiEndpoints: ApiEndpointConfig[];
}

// Full Site Configuration
export interface SiteConfig {
  siteId: string;
  scrubPercent: number;
  pages: Record<string, PageConfig>;
  metadata?: SiteConfigMetadata;
}

// Permission matrix for different operations
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  viewer: [
    'view_config',
    'view_kv',
    'view_logs'
  ],
  pixel_manager: [
    'view_config',
    'view_kv',
    'view_logs',
    'edit_pixels',
    'edit_pixel_kv'
  ],
  admin: [
    'view_config',
    'view_kv',
    'view_logs',
    'edit_pixels',
    'edit_pixel_kv',
    'edit_api_endpoints',
    'edit_system_settings',
    'manage_users'
  ]
};