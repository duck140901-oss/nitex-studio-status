import { readSession, jsonResponse, verifyDashboardUser, ONEDRIVE_OWNER_EMAIL } from "../../_shared/auth.js";

export async function onRequest({ request, env }) {
  const user = await verifyDashboardUser(request);
  if (!user) return jsonResponse({ authenticated: false, connected: false }, 401);
  let stored = await env.AUTH_KV.get("onedrive:shared");
  if (!stored && user.email === ONEDRIVE_OWNER_EMAIL) {
    const oldSession = await readSession(request, env);
    if (oldSession?.data?.email === ONEDRIVE_OWNER_EMAIL && oldSession.data.refreshToken) {
      const sharedConnection = { displayName: oldSession.data.displayName || "", email: oldSession.data.email, refreshToken: oldSession.data.refreshToken, updatedAt: new Date().toISOString() };
      await env.AUTH_KV.put("onedrive:shared", JSON.stringify(sharedConnection), { expirationTtl: 7776000 });
      stored = JSON.stringify(sharedConnection);
    }
  }
  let connection = null;
  if (stored) {
    try { connection = JSON.parse(stored); }
    catch { await env.AUTH_KV.delete("onedrive:shared"); }
  }
  return jsonResponse({ authenticated: true, connected: Boolean(connection?.refreshToken), user: { email: user.email }, owner: connection?.email || null });
}
