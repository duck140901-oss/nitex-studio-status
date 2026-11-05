import { readSession, jsonResponse } from "../../_shared/auth.js";

export async function onRequest({ request, env }) {
  const session = await readSession(request, env);
  if (!session) return jsonResponse({ authenticated: false });
  return jsonResponse({
    authenticated: true,
    user: {
      displayName: session.data.displayName,
      email: session.data.email
    }
  });
}