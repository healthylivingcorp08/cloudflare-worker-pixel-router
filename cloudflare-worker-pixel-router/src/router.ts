import { SiteConfig, PixelType } from './types';

/**
 * Determines which pixel to fire based on the site's scrub percent.
 * Returns the pixel type and the corresponding URL.
 */
export function routePixel(config: SiteConfig): { pixelType: PixelType; pixelUrl: string } {
  const rand = Math.random() * 100;
  if (rand < config.scrubPercent) {
    return { pixelType: 'scrub', pixelUrl: config.scrubPixelUrl };
  } else {
    return { pixelType: 'normal', pixelUrl: config.normalPixelUrl };
  }
}