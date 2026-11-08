export async function onRequest({ env }) {
  return new Response(JSON.stringify({
    ok: true,
    authKvConfigured: Boolean(env.AUTH_KV),
    microsoftClientConfigured: Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_TENANT_ID && env.MICROSOFT_CLIENT_SECRET),
    encryptionKeyConfigured: Boolean(env.TOKEN_ENCRYPTION_KEY)
  }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}