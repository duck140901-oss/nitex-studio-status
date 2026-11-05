import { SESSION_COOKIE, getSessionId, jsonResponse } from "../../../_shared/auth.js";

export async function onRequest({ request, env }) {
  const id = getSessionId(request);
  if (id) await env.AUTH_KV.delete("session:" + id);
  const response = jsonResponse({ success: true });
  const headers = new Headers(response.headers);
  headers.append("set-cookie", SESSION_COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return new Response(response.body, { status: response.status, headers });
}