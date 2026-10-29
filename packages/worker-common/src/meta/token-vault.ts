import { decodeBase64url, encodeBase64url } from "./encoding";

const encoder = new TextEncoder();
const maximumTokenLength = 16_384;

function associatedData(context: string): Uint8Array<ArrayBuffer> {
  if (!context || context.length > 1024)
    throw new Error("Token context is required");
  return encoder.encode(`fadeloop:token:v1:${context}`);
}

export async function createTokenVault(encodedKey: string) {
  const bytes = decodeBase64url(encodedKey);
  if (bytes.length !== 32) throw new Error("Token key must contain 32 bytes");
  const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  return {
    async seal(token: string, context: string): Promise<string> {
      if (!token || token.length > maximumTokenLength)
        throw new Error("Invalid token size");
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: associatedData(context) },
        key,
        encoder.encode(token),
      );
      return `v1.${encodeBase64url(iv)}.${encodeBase64url(new Uint8Array(ciphertext))}`;
    },
    async open(envelope: string, context: string): Promise<string> {
      try {
        if (envelope.length > 100_000) throw new Error("Oversized envelope");
        const [version, nonce, sealed, extra] = envelope.split(".");
        if (version !== "v1" || !nonce || !sealed || extra !== undefined)
          throw new Error("Invalid envelope");
        const iv = decodeBase64url(nonce);
        if (iv.length !== 12) throw new Error("Invalid nonce");
        const plaintext = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv, additionalData: associatedData(context) },
          key,
          decodeBase64url(sealed),
        );
        const token = new TextDecoder("utf-8", { fatal: true }).decode(
          plaintext,
        );
        if (!token || token.length > maximumTokenLength)
          throw new Error("Invalid token size");
        return token;
      } catch {
        throw new Error("Unable to decrypt token");
      }
    },
  };
}
