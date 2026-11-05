import { getMicrosoftConfig, readSession, jsonResponse } from "../_shared/auth.js";
import { decryptToken, encryptToken } from "../_shared/crypto.js";

const WORKBOOK_SHARE_URL = "https://nitexsol-my.sharepoint.com/:x:/g/personal/alamin_nitex_com/IQCGNsicNhQHQaCccySz1sPmAdZEYoo2kj2iePBDLhZFWj4?e=Jxym6u";

function toShareId(url) {
  const encoded = btoa(url);
  return "u!" + encoded.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(env, session, cfg) {
  const oldRefreshToken = await decryptToken(session.data.refreshToken, cfg.encryptionKey);
  const response = await fetch(
    "https://login.microsoftonline.com/" + cfg.tenantId + "/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        grant_type: "refresh_token",
        refresh_token: oldRefreshToken,
        scope: "openid profile offline_access User.Read Files.Read"
      })
    }
  );
  const tokens = await response.json();
  if (!response.ok || !tokens.access_token) {
    throw new Error(tokens.error_description || "Microsoft session expired. Please sign in again.");
  }
  if (tokens.refresh_token) {
    session.data.refreshToken = await encryptToken(tokens.refresh_token, cfg.encryptionKey);
    await env.AUTH_KV.put("session:" + session.id, JSON.stringify(session.data), { expirationTtl: 2592000 });
  }
  return tokens.access_token;
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405);
  const session = await readSession(request, env);
  if (!session) return jsonResponse({ error: "Please sign in with your NITEX account." }, 401);

  try {
    const cfg = getMicrosoftConfig(env);
    const accessToken = await getAccessToken(env, session, cfg);
    const shareResponse = await fetch(
      "https://graph.microsoft.com/v1.0/shares/" + toShareId(WORKBOOK_SHARE_URL) + "/driveItem",
      { headers: { authorization: "Bearer " + accessToken } }
    );
    const item = await shareResponse.json();
    if (!shareResponse.ok || !item.id || !item.parentReference?.driveId) {
      return jsonResponse({
        error: item.error?.message || "Microsoft Graph could not locate the shared workbook. Check that this account has permission to open it."
      }, 502);
    }

    const downloadResponse = await fetch(
      "https://graph.microsoft.com/v1.0/drives/" +
        encodeURIComponent(item.parentReference.driveId) +
        "/items/" + encodeURIComponent(item.id) + "/content",
      { headers: { authorization: "Bearer " + accessToken } }
    );
    if (!downloadResponse.ok) {
      return jsonResponse({ error: "OneDrive workbook download failed." }, 502);
    }

    const headers = new Headers({
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'inline; filename="Version_2.0_Studio_Status_Tracker.xlsx"',
      "cache-control": "private, no-store"
    });
    return new Response(downloadResponse.body, { status: 200, headers });
  } catch (error) {
    return jsonResponse({ error: error.message || "Workbook sync failed." }, 502);
  }
}