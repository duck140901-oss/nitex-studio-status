import { getMicrosoftConfig, jsonResponse, randomHex } from "../../_shared/auth.js";
import { encryptToken } from "../../_shared/crypto.js";

export async function onRequest({ request, env }) {
  try {
    const cfg = getMicrosoftConfig(env);
    const url = new URL(request.url);
    const authError = url.searchParams.get("error");
    if (authError) return new Response("Microsoft sign-in was cancelled or denied. Return to the dashboard and try again.", { status: 400 });

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return new Response("Missing authorization response. Please try signing in again.", { status: 400 });

    const cookieHeader = request.headers.get("Cookie") || "";
    const stateCookie = cookieHeader.split(";").map(v => v.trim()).find(v => v.startsWith("nitex_oauth_state="));
    const browserState = stateCookie ? decodeURIComponent(stateCookie.slice("nitex_oauth_state=".length)) : "";
    const stateKey = "oauth-state:" + state;
    const stateValue = await env.AUTH_KV.get(stateKey);
    await env.AUTH_KV.delete(stateKey);
    if (stateValue !== "valid" || !browserState || browserState !== state) {
      return new Response("Sign-in request expired or could not be verified. Please try again.", { status: 400 });
    }

    const tokenResponse = await fetch(
      "https://login.microsoftonline.com/" + cfg.tenantId + "/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: cfg.redirectUri,
          scope: "openid profile offline_access User.Read Files.Read"
        })
      }
    );
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token || !tokens.refresh_token) {
      return jsonResponse({ error: tokens.error_description || "Microsoft sign-in token exchange failed." }, 502);
    }

    const profileResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName",
      { headers: { authorization: "Bearer " + tokens.access_token } }
    );
    const profile = await profileResponse.json();
    if (!profileResponse.ok) return jsonResponse({ error: "Microsoft account could not be verified." }, 502);

    const email = (profile.mail || profile.userPrincipalName || "").toLowerCase();
    const allowed = [
      "touhid@nitex.com",
      "moru@nitex.com",
      "shachi@nitex.com",
      "alamin@nitex.com",
      "sowrav@nitex.com"
    ];
    if (!allowed.includes(email)) return new Response("This Microsoft account is not on the Studio Dashboard access list.", { status: 403 });

    const sessionId = randomHex(32);
    const session = {
      displayName: profile.displayName || "",
      email,
      refreshToken: await encryptToken(tokens.refresh_token, cfg.encryptionKey),
      createdAt: new Date().toISOString()
    };
    await env.AUTH_KV.put("session:" + sessionId, JSON.stringify(session), { expirationTtl: 2592000 });

    return new Response(null, {
      status: 302,
      headers: {
        location: "/?onedrive=connected",
        "set-cookie": [
          "nitex_studio_session=" + sessionId + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000",
          "nitex_oauth_state=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
        ],
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    return jsonResponse({ error: error.message || "Microsoft authentication failed." }, 500);
  }
}