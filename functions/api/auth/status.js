import { readSession, jsonResponse, verifyDashboardUser } from "../../_shared/auth.js";

export async function onRequest({ request, env }) {
  const user = await verifyDashboardUser(request);
  if (!user) return jsonResponse({ authenticated: false, connected: false }, 401);
  const stored = await env.AUTH_KV.get("onedrive:shared");
  let connection = null;
  if (stored) {
    try { connection = JSON.parse(stored); } catch { await env.AUTH_KV.delete("onedrive:shared"); }
  }
  return jsonResponse({
    authenticated: true,
    connected: Boolean(connection?.refreshToken),
    user: { email: user.email },
    owner: connection?.email || null
  });
}
