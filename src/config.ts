import { SiteConfig, Env } from './types';

/**
 * Fetches the site config from Cloudflare KV.
 * @param site - The site key (string)
 * @param env - The Worker environment (must include PIXEL_CONFIG KV binding)
 * @returns Promise<SiteConfig | undefined>
 */
export async function getSiteConfig(site: string, env: Env): Promise<SiteConfig | undefined> {
  const configStr = await env.PIXEL_CONFIG.get(site);
  if (!configStr) return undefined;
  try {
    return JSON.parse(configStr) as SiteConfig;
  } catch {
    return undefined;
  }
}