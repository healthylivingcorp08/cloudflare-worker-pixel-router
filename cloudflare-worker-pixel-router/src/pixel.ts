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