import { getMicrosoftConfig, randomHex } from "../../_shared/auth.js";

export async function onRequest({ env }) {
  try {
    const cfg = getMicrosoftConfig(env);
    const state = randomHex(24);
    await env.AUTH_KV.put("oauth-state:" + state, "valid", { expirationTtl: 600 });

    const authorize = new URL(
      "https://login.microsoftonline.com/" + cfg.tenantId + "/oauth2/v2.0/authorize"
    );
    authorize.search = new URLSearchParams({
      client_id: cfg.clientId,
      response_type: "code",
      redirect_uri: cfg.redirectUri,
      response_mode: "query",
      scope: "openid profile offline_access User.Read Files.Read",
      state
    }).toString();

    return Response.redirect(authorize.toString(), 302);
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  }
}