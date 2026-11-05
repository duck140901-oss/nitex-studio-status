function keyBytes(hex) {
  if (!/^[0-9a-f]{64}$/i.test(hex || "")) {
    throw new Error("TOKEN_ENCRYPTION_KEY must contain 64 hexadecimal characters.");
  }
  return new Uint8Array(hex.match(/.{2}/g).map(part => parseInt(part, 16)));
}

function encode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decode(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

export async function encryptToken(value, secret) {
  const key = await crypto.subtle.importKey("raw", keyBytes(secret), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value)
  );
  return encode(iv) + "." + encode(new Uint8Array(cipher));
}

export async function decryptToken(value, secret) {
  const parts = (value || "").split(".");
  if (parts.length !== 2) throw new Error("Encrypted token format is invalid.");
  const key = await crypto.subtle.importKey("raw", keyBytes(secret), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decode(parts[0]) },
    key,
    decode(parts[1])
  );
  return new TextDecoder().decode(plain);
}