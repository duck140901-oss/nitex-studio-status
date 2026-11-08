import { getMicrosoftConfig, randomHex, jsonResponse, verifyDashboardUser, ONEDRIVE_OWNER_EMAIL } from "../../_shared/auth.js";

export async function onRequest({ request, env }) {
  try {
    const dashboardUser = await verifyDashboardUser(request);
    if (!dashboardUser) return jsonResponse({ error: "Please sign in with an authorized NITEX Dashboard account." }, 401);
    if (dashboardUser.email !== ONEDRIVE_OWNER_EMAIL) {
      return jsonResponse({ error: "Only Alamin can connect the shared OneDrive account." }, 403);
    }
    const cfg = getMicrosoftConfig(env, request);
    const state = randomHex(24);
    await env.AUTH_KV.put("oauth-state:" + state, "valid", { expirationTtl: 600 });
    const authorize = new URL("https://login.microsoftonline.com/" + cfg.tenantId + "/oauth2/v2.0/authorize");
    authorize.search = new URLSearchParams({
      client_id: cfg.clientId,
      response_type: "code",
      redirect_uri: cfg.redirectUri,
      response_mode: "query",
      scope: "openid profile offline_access User.Read Files.Read",
      state
    }).toString();
    const response = jsonResponse({ authorizationUrl: authorize.toString() });
    const headers = new Headers(response.headers);
    headers.append("set-cookie", "nitex_oauth_state=" + state + "; Domain=.nitex-studio-status.pages.dev; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600");
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    return jsonResponse({ error: error.message || "Could not start Microsoft sign-in." }, 500);
  }
}
