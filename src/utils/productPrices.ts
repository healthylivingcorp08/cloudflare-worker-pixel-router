import { Env } from '../types';
import drivebrightConfig from '../../config/sites/drivebright.json';

interface ProductPriceConfig {
  [productId: string]: number;
}

const productPrices: ProductPriceConfig = drivebrightConfig.products || {};

export function getDefaultProductPrice(productId: string): number {
  return productPrices[productId] || 0;
}

export async function getProductPrice(env: Env, productId: string): Promise<number> {
  try {
    // First try KV store
    const kvPrice = await env.PRODUCT_PRICES.get(`price:${productId}`);
    if (kvPrice) {
      return parseFloat(kvPrice);
    }
    
    // Fallback to config
    return getDefaultProductPrice(productId);
  } catch (error) {
    console.error(`[ProductPrices] Error getting price for product ${productId}:`, error);
    return 0;
  }
}