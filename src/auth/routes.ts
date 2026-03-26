import type { IncomingMessage, ServerResponse } from "node:http";
import type { EntraConfig } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// RFC 9728 — OAuth Protected Resource Metadata
// GET /.well-known/oauth-protected-resource
// ---------------------------------------------------------------------------

export function handleProtectedResource(
  res: ServerResponse,
  config: EntraConfig,
): void {
  sendJson(res, 200, {
    resource: `${config.serverUrl}/mcp`,
    authorization_servers: [config.serverUrl],
    bearer_methods_supported: ["header"],
    scopes_supported: [`api://${config.clientId}/access_as_user`],
  });
}

// ---------------------------------------------------------------------------
// RFC 8414 — Authorization Server Metadata
// GET /.well-known/oauth-authorization-server
//
// IMPORTANT: issuer must equal serverUrl (not Azure AD's issuer).
// Claude.ai validates issuer === the URL prefix used to fetch this document.
// ---------------------------------------------------------------------------

export function handleAuthServerMetadata(
  res: ServerResponse,
  config: EntraConfig,
): void {
  sendJson(res, 200, {
    issuer: config.serverUrl,
    authorization_endpoint: `${config.serverUrl}/authorize`,
    token_endpoint: `${config.serverUrl}/token`,
    registration_endpoint: `${config.serverUrl}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [
      `api://${config.clientId}/access_as_user`,
      "openid",
      "profile",
      "email",
      "offline_access",
    ],
  });
}

// ---------------------------------------------------------------------------
// Dynamic Client Registration (RFC 7591)
// POST /register
//
// Azure AD doesn't support open DCR. We return the pre-registered client_id
// so Claude.ai can proceed with the OAuth flow.
// ---------------------------------------------------------------------------

export async function handleRegister(
  req: IncomingMessage,
  res: ServerResponse,
  config: EntraConfig,
): Promise<void> {
  // Read and discard request body (Claude.ai sends redirect_uris etc.)
  await readBody(req);

  sendJson(res, 201, {
    client_id: config.clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
    grant_types: ["authorization_code", "refresh_token"],
    token_endpoint_auth_method: "none",
  });
}

// ---------------------------------------------------------------------------
// Authorization proxy
// GET /authorize
//
// Rewrites the request for Azure AD:
//   - Replaces client_id with AZURE_CLIENT_ID
//   - Replaces scope with the API scope
//   - Passes PKCE params and redirect_uri through unchanged
// ---------------------------------------------------------------------------

export function handleAuthorize(
  req: IncomingMessage,
  res: ServerResponse,
  config: EntraConfig,
): void {
  const incomingUrl = new URL(
    req.url ?? "/",
    `https://${req.headers.host ?? "localhost"}`,
  );

  const azureParams = new URLSearchParams();

  // Pass through PKCE and flow params
  for (const key of [
    "response_type",
    "redirect_uri",
    "state",
    "code_challenge",
    "code_challenge_method",
    "nonce",
    "response_mode",
    "login_hint",
  ]) {
    const val = incomingUrl.searchParams.get(key);
    if (val !== null) azureParams.set(key, val);
  }

  // Override client_id and scope
  azureParams.set("client_id", config.clientId);
  azureParams.set(
    "scope",
    `api://${config.clientId}/access_as_user openid profile email offline_access`,
  );

  const azureAuthUrl =
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?` +
    azureParams.toString();

  res.writeHead(302, { Location: azureAuthUrl });
  res.end();
}

// ---------------------------------------------------------------------------
// Token proxy
// POST /token
//
// Proxies the token exchange to Azure AD, replacing client_id.
// ---------------------------------------------------------------------------

export async function handleToken(
  req: IncomingMessage,
  res: ServerResponse,
  config: EntraConfig,
): Promise<void> {
  const body = await readBody(req);
  const params = new URLSearchParams(body);

  // Override client_id; forward everything else
  params.set("client_id", config.clientId);

  const azureTokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;

  try {
    const azureRes = await fetch(azureTokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const azureBody = await azureRes.text();

    res.writeHead(azureRes.status, {
      "Content-Type": "application/json",
    });
    res.end(azureBody);
  } catch (err) {
    console.error("[auth] Token proxy error:", err);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "token_proxy_error", error_description: "Failed to reach Azure AD" }));
  }
}
