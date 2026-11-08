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

export function getMicrosoftConfig(env, request) {
  const names = [
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_TENANT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "TOKEN_ENCRYPTION_KEY"
  ];
  const missing = names.filter(name => !env[name]);
  if (!env.AUTH_KV) missing.push("AUTH_KV");
  if (missing.length) throw new Error("Missing configuration: " + missing.join(", "));
  const requestUrl = request ? new URL(request.url) : null;
  const hostname = requestUrl?.hostname || "nitex-studio-status.pages.dev";
  const allowedHost = hostname === "nitex-studio-status.pages.dev" || hostname.endsWith(".nitex-studio-status.pages.dev");
  if (!allowedHost) throw new Error("This website host is not approved for Microsoft sign-in.");
  return {
    clientId: env.MICROSOFT_CLIENT_ID,
    tenantId: env.MICROSOFT_TENANT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    encryptionKey: env.TOKEN_ENCRYPTION_KEY,
    redirectUri: (hostname === "nitex-studio-status.pages.dev" ? "https://nitex-studio-status.pages.dev" : "https://feature-microsoft-onedrive-s.nitex-studio-status.pages.dev") + "/api/auth/callback"
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

const SUPABASE_URL = "https://dodslzhjjltkenmbxpia.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Xxcz13oqUkVKeJb8ZUtpLw_MiB7wkx";
export const STUDIO_EMAILS = [
  "touhid@nitex.com",
  "moru@nitex.com",
  "shachi@nitex.com",
  "alamin@nitex.com",
  "sowrav@nitex.com"
];
export const ONEDRIVE_OWNER_EMAIL = "alamin@nitex.com";
export const ONEDRIVE_UPDATE_EMAILS = ["alamin@nitex.com", "sowrav@nitex.com"];

export async function verifyDashboardUser(request) {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      authorization: "Bearer " + match[1]
    }
  });
  if (!response.ok) return null;
  const user = await response.json();
  const email = (user.email || "").toLowerCase();
  if (!STUDIO_EMAILS.includes(email)) return null;
  return { id: user.id, email };
}
