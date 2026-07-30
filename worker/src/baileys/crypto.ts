import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

function loadKey(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `WHATSAPP_SESSION_KEY precisa ter ${KEY_BYTES} bytes em base64 (recebido: ${key.length})`,
    );
  }
  return key;
}

/** `iv.tag.ciphertext` em base64. */
export function encryptSession(plaintext: string, keyB64: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, loadKey(keyB64), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((p) => p.toString("base64"))
    .join(".");
}

export function decryptSession(payload: string, keyB64: string): string {
  const [ivB64, tagB64, ciphertextB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error("Credencial de sessão malformada");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    loadKey(keyB64),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
