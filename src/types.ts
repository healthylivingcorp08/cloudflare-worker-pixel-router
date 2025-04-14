import type { KVNamespace } from '@cloudflare/workers-types';

export interface SiteConfig {
  scrubPercent: number;
  normalPixelUrl: string;
  scrubPixelUrl: string;
  postbackUrl: string;
}

export interface SitesConfig {
  [site: string]: SiteConfig;
}

export interface ConversionData {
  site: string;
  [key: string]: any; // Other order/conversion fields
}

export type PixelType = 'normal' | 'scrub';

export interface PixelRouteResult {
  pixelType: PixelType;
  pixelUrl: string;
  fired: boolean;
}

// Cloudflare Worker environment type for KV binding
export interface Env {
  PIXEL_CONFIG: KVNamespace;
}