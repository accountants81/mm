const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function keyFromPassword(password: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: 120000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
function b64(bytes: Uint8Array) { let binary = ""; bytes.forEach(byte => { binary += String.fromCharCode(byte); }); return btoa(binary); }
function bytes(value: string) { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }

export async function encryptBackup(json: string, password: string): Promise<string> {
  if (!password) throw new Error("يجب إدخال كلمة مرور للتشفير");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFromPassword(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(json));
  return JSON.stringify({ format: "abd-elaziz-omran-encrypted-backup", version: 1, salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(encrypted)) });
}

export async function decryptBackup(encrypted: string, password: string): Promise<string> {
  try {
    const payload = JSON.parse(encrypted) as { format?: string; version?: number; salt?: string; iv?: string; data?: string };
    if (payload.format !== "abd-elaziz-omran-encrypted-backup" || !payload.salt || !payload.iv || !payload.data) throw new Error();
    const key = await keyFromPassword(password, bytes(payload.salt));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(payload.iv) }, key, bytes(payload.data));
    return decoder.decode(plain);
  } catch { throw new Error("تعذر فك تشفير النسخة. تحقق من كلمة المرور والملف."); }
}
