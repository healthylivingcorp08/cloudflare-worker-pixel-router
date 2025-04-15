import { ResolutionContext, UrlContext } from './types';

// Enum for placeholder types
enum PlaceholderType {
  KV = 'KV',
  URL = 'URL',
  SECRET = 'SECRET',
  CONTEXT = 'CONTEXT'
}

// Interface for parsed placeholder
interface ParsedPlaceholder {
  type: PlaceholderType;
  key: string;
}

/**
 * Parse a placeholder string into its components
 * @param placeholder String in format "{TYPE:key}"
 */
function parsePlaceholder(placeholder: string): ParsedPlaceholder | null {
  const match = placeholder.match(/^\{(KV|URL|SECRET|CONTEXT):(.+)\}$/);
  if (!match) return null;

  return {
    type: match[1] as PlaceholderType,
    key: match[2]
  };
}

/**
 * Resolve a single value based on its placeholder type
 */
async function resolvePlaceholderValue(
  parsed: ParsedPlaceholder,
  context: ResolutionContext
): Promise<string> {
  switch (parsed.type) {
    case PlaceholderType.KV:
      const value = await context.kv.get(parsed.key);
      if (value === null) {
        throw new Error(`KV value not found for key: ${parsed.key}`);
      }
      return value;

    case PlaceholderType.URL:
      const urlValue = context.url.params[parsed.key];
      if (!urlValue) {
        throw new Error(`URL parameter not found: ${parsed.key}`);
      }
      return urlValue;

    case PlaceholderType.SECRET:
      const secret = context.secrets[parsed.key];
      if (!secret) {
        throw new Error(`Secret not found: ${parsed.key}`);
      }
      return secret;

    case PlaceholderType.CONTEXT:
      // Context values would be passed in from the handler
      throw new Error('CONTEXT placeholder type not yet implemented');

    default:
      throw new Error(`Unknown placeholder type: ${parsed.type}`);
  }
}

/**
 * Recursively resolve all placeholders in an object
 */
export async function resolvePlaceholders<T>(
  obj: T,
  context: ResolutionContext
): Promise<T> {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    const resolved = await Promise.all(
      obj.map(item => resolvePlaceholders(item, context))
    );
    return resolved as unknown as T;
  }

  const resolved: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const parsed = parsePlaceholder(value);
      if (parsed) {
        resolved[key] = await resolvePlaceholderValue(parsed, context);
      } else {
        resolved[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      resolved[key] = await resolvePlaceholders(value, context);
    } else {
      resolved[key] = value;
    }
  }

  return resolved as T;
}

/**
 * Helper function to create URL context from Request
 */
export function createUrlContext(request: Request): UrlContext {
  const url = new URL(request.url);
  const params: { [key: string]: string } = {};
  
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return {
    params,
    path: url.pathname,
    hostname: url.hostname
  };
}

/**
 * Create a resolution context from request and environment
 */
export function createResolutionContext(
  request: Request,
  env: { [key: string]: any }
): ResolutionContext {
  return {
    url: createUrlContext(request),
    kv: env.PIXEL_CONFIG,
    secrets: {
      stickyio_api_key: env.STICKYIO_API_KEY
      // Add other secrets as needed
    }
  };
}