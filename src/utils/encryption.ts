export interface EncryptedData {
  iv: string;
  ciphertext: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

import { Env } from '../types'; // Assuming Env type includes ENCRYPTION_SECRET

// Removed module-level ENCRYPTION_KEY

export async function encryptData(data: unknown, env: Env): Promise<EncryptedData> {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await getKey(env), // Pass env
      encoder.encode(JSON.stringify(data))
    );

    return {
      iv: Array.from(iv).join(','),
      ciphertext: Array.from(new Uint8Array(ciphertext)).join(',')
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

export async function decryptData(encrypted: EncryptedData, env: Env): Promise<unknown> {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM',
        iv: new Uint8Array(encrypted.iv.split(',').map(Number))
      },
      await getKey(env), // Pass env
      new Uint8Array(encrypted.ciphertext.split(',').map(Number))
    );

    return JSON.parse(decoder.decode(decrypted));
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

async function getKey(env: Env): Promise<CryptoKey> {
  // Get encryption key from environment
  const secret = env.ENCRYPTION_SECRET || 'default-32-byte-encryption-key-here';
  if (!env.ENCRYPTION_SECRET) {
    console.warn("ENCRYPTION_SECRET not found in env, using default key. THIS IS INSECURE FOR PRODUCTION.");
  }
  const encodedKey = encoder.encode(secret);

  return crypto.subtle.importKey(
    'raw',
    encodedKey, // Use key derived from env
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}