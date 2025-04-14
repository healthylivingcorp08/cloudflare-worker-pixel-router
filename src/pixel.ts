import { ConversionData } from './types';

/**
 * Fires a pixel/postback by sending a POST request to the given URL with the conversion data.
 * Returns true if the request was successful (2xx), false otherwise.
 */
export async function firePixel(url: string, data: ConversionData): Promise<boolean> {
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return resp.ok;
  } catch (err) {
    // Network or other error
    return false;
  }
}

/**
 * Fires a Sticky.io "New Order" API request.
 * Returns the API response as JSON, or null on error.
 */
export async function fireStickyOrder(orderData: any, username: string, password: string): Promise<any | null> {
  try {
    const resp = await fetch('https://techcommerceunlimited.sticky.io/api/v1/new_order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(username + ':' + password)
      },
      body: JSON.stringify(orderData),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (err) {
    return null;
  }
}