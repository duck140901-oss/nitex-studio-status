export const SESSION_COOKIE = "nitex_studio_session";
export const MICROSOFT_SCOPES = "openid profile offline_access User.Read Files.Read";

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export function getSessionId(request) {
  const cookie = request.headers.get("Cookie") || "";
  const entry = cookie.split(";").map(x => x.trim()).find(x => x.startsWith(SESSION_COOKIE + "="));
  return entry ? decodeURIComponent(entry.slice(SESSION_COOKIE.length + 1)) : null;
}

export function getMicrosoftConfig(env) {
  const names = [
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_TENANT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "TOKEN_ENCRYPTION_KEY"
  ];
  const missing = names.filter(name => !env[name]);
  if (!env.AUTH_KV) missing.push("AUTH_KV");
  if (missing.length) throw new Error("Missing configuration: " + missing.join(", "));
  return {
    clientId: env.MICROSOFT_CLIENT_ID,
    tenantId: env.MICROSOFT_TENANT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    encryptionKey: env.TOKEN_ENCRYPTION_KEY,
    redirectUri: "https://nitex-studio-status.pages.dev/api/auth/callback"
  };
}

export async function readSession(request, env) {
  const id = getSessionId(request);
  if (!id) return null;
  const value = await env.AUTH_KV.get("session:" + id);
  if (!value) return null;
  try {
    return { id, data: JSON.parse(value) };
  } catch {
    await env.AUTH_KV.delete("session:" + id);
    return null;
  }
}

export function randomHex(length = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}