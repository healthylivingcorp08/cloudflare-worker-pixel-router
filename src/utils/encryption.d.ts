declare module '@utils/encryption' {
  export interface EncryptedData {
    iv: string;
    ciphertext: string;
  }

  export function encryptData(data: unknown): Promise<EncryptedData>;
  export function decryptData(encrypted: EncryptedData): Promise<unknown>;
}