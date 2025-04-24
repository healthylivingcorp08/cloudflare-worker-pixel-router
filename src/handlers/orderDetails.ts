import { Env, ExtendedOrderConfirmation, Product, Address } from '../types'; // Import necessary types
import { ExecutionContext } from '@cloudflare/workers-types';
import { addCorsHeaders } from '../middleware/cors';
import { callStickyOrderView } from '../lib/sticky'; // Import the Sticky.io library function
import { getDefaultProductPrice } from '../utils/productPrices';

/**
 * Handles POST requests to /api/order-details.
 * Fetches order details from Sticky.io based on the provided orderId.
 */
export async function handleOrderDetails(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const body = await request.json() as { orderId?: string | number }; // Allow number or string
    const orderId = body.orderId;

    if (!orderId) {
      return addCorsHeaders(new Response(JSON.stringify({ message: 'Missing orderId in request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } }), request);
    }

    // Ensure orderId is treated as a string for the API call
    const orderIdStr = String(orderId);

    console.log(`[OrderDetailsHandler] Fetching order details for orderId: ${orderIdStr}`);

    // --- 1. Call Sticky.io API using the library function ---
    const stickyResponse = await callStickyOrderView([orderIdStr], env); // Pass order ID as an array

    console.log(`[OrderDetailsHandler] Sticky.io Order View Response Status: ${stickyResponse._status}`);
    console.log(`[OrderDetailsHandler] Sticky.io Order View Response Body: ${JSON.stringify(stickyResponse)}`);

    // --- 2. Handle Sticky.io Response ---
    // Check for HTTP errors or API-level errors reported by callStickyOrderView
    if (!stickyResponse._ok || stickyResponse.response_code !== '100') {
        const errorMessage = stickyResponse.error_message || `Sticky.io Order View API Error (Code: ${stickyResponse.response_code || stickyResponse._status})`;
        console.error(`[OrderDetailsHandler] Sticky.io Order View FAILED for orderId ${orderIdStr}: ${errorMessage}`, stickyResponse._rawBody);
        const status = stickyResponse._status >= 500 ? 502 : 400; // 502 Bad Gateway or 400 Bad Request
        return addCorsHeaders(new Response(JSON.stringify({ success: false, message: errorMessage, details: stickyResponse._rawBody }), { status: status, headers: { 'Content-Type': 'application/json' } }), request);
    }

    // --- SUCCESS ---
    const stickyData = stickyResponse; // The parsed data is the response itself

    console.log(`[OrderDetailsHandler] Successfully fetched details for orderId: ${orderIdStr}`);
    // console.log('[OrderDetailsHandler] Sticky.io Order View Response Body JSON:', JSON.stringify(stickyData));


    // --- 3. Map Sticky.io response to OrderConfirmation ---
    const mappedOrder: ExtendedOrderConfirmation = {
      orderId: stickyData.order_id?.toString() || orderIdStr,
      orderNumbers: stickyData.order_id?.toString() || orderIdStr,
      customerEmail: stickyData.email || stickyData.billing_email || undefined,
      products: (stickyData.products || []).map((item: any): Product => ({
        product_name: item.name || 'Unknown Product',
        quantity: parseInt(item.product_qty || '1'),
        unitPrice: (() => {
          // Try price fields in order of preference
          let price = parseFloat(item.price || item.discountPrice || item.priceRate || item.regPrice || '0');
          
          // If price is 0, try orderTotal split
          if (price === 0 && stickyData.orderTotal > 0) {
            price = stickyData.orderTotal / (stickyData.products?.length || 1);
          }
          
          // If still 0, use default price from product config
          if (price === 0) {
            const defaultPrice = getDefaultProductPrice(item.product_id);
            if (defaultPrice > 0) {
              price = defaultPrice;
              console.warn(`[OrderDetailsHandler] Using default price ${defaultPrice} for product ${item.product_id}`);
            } else {
              console.error(`[OrderDetailsHandler] No valid price found for product ${item.product_id}`);
            }
          }
          
          return price;
        })(),
        priceRate: parseFloat(item.priceRate || '0'),
        discountPrice: parseFloat(item.discountPrice || '0'),
        regPrice: parseFloat(item.regPrice || '0'),
        shipPrice: parseFloat(item.shipPrice || '0'),
        product_id: item.product_id
      })),
      shippingFee: parseFloat(stickyData.totals_breakdown?.shipping ?? stickyData.shipping_amount ?? '0'),
      billingAddress: {
        address1: stickyData.billing_street_address || '',
        address2: stickyData.billing_street_address2 || undefined,
        city: stickyData.billing_city || '',
        state: stickyData.billing_state || '',
        country: stickyData.billing_country || '',
        zip: stickyData.billing_postcode || ''
      },
      shippingAddress: {
        address1: stickyData.shipping_street_address || '',
        address2: stickyData.shipping_street_address2 || undefined,
        city: stickyData.shipping_city || '',
        state: stickyData.shipping_state || '',
        country: stickyData.shipping_country || '',
        zip: stickyData.shipping_postcode || ''
      },
      creditCardType: stickyData.credit_card_type,
      totalValue: 0 // Will be calculated below
    };

    // Calculate total value after mappedOrder is fully defined
    // Calculate total value
    mappedOrder.totalValue = mappedOrder.products.reduce((sum, product) => {
      return sum + (product.unitPrice * product.quantity);
    }, 0) + mappedOrder.shippingFee;
    // --- End Mapping ---

    // --- 4. Return Success Response ---
    const response = new Response(JSON.stringify(mappedOrder), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return addCorsHeaders(response, request);

  } catch (error: any) {
    console.error('[OrderDetailsHandler] Error fetching order details:', error);
    // Ensure error response is JSON and includes CORS headers
    const response = new Response(JSON.stringify({ message: `Error fetching order details: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    return addCorsHeaders(response, request);
  }
}