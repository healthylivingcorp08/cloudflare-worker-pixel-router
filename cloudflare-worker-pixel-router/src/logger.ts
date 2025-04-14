import { ConversionData, PixelType } from './types';

/**
 * Stub logger for auditability.
 * In production, this could log to a database, external service, or Cloudflare Logpush.
 */
export function logConversion(data: ConversionData, pixelType: PixelType): void {
  // No-op for MVP
}