/**
 * ConnectWise Manage API Client
 *
 * Fetch-based HTTP client that handles authentication, pagination,
 * and self-signed certificate support for both cloud and self-hosted instances.
 *
 * Environment variables:
 *   CW_MANAGE_URL              - API base URL (e.g. https://api-na.myconnectwise.net)
 *   CW_MANAGE_COMPANY_ID       - Company identifier
 *   CW_MANAGE_PUBLIC_KEY        - API member public key
 *   CW_MANAGE_PRIVATE_KEY       - API member private key
 *   CW_MANAGE_CLIENT_ID         - Client ID from ConnectWise Developer Portal
 *   CW_MANAGE_REJECT_UNAUTHORIZED - Set to "false" to allow self-signed certs (default: "true")
 */

export interface CwManageConfig {
  baseUrl: string;
  companyId: string;
  publicKey: string;
  privateKey: string;
  clientId: string;
}

export function getConfig(): CwManageConfig | null {
  const companyId = process.env.CW_MANAGE_COMPANY_ID;
  const publicKey = process.env.CW_MANAGE_PUBLIC_KEY;
  const privateKey = process.env.CW_MANAGE_PRIVATE_KEY;
  const clientId = process.env.CW_MANAGE_CLIENT_ID;

  if (!companyId || !publicKey || !privateKey || !clientId) {
    return null;
  }

  // Default to North America cloud. Override for EU, AU, or self-hosted.
  const baseUrl = (
    process.env.CW_MANAGE_URL || "https://api-na.myconnectwise.net"
  ).replace(/\/+$/, "");

  return { baseUrl, companyId, publicKey, privateKey, clientId };
}

/**
 * Low-level API client for ConnectWise Manage REST API.
 */
export class CwManageClient {
  private readonly authHeader: string;
  private readonly clientId: string;
  private readonly apiBase: string;
  private readonly rejectUnauthorized: boolean;

  constructor(config: CwManageConfig) {
    // Auth: Basic base64("{companyId}+{publicKey}:{privateKey}")
    const credentials = `${config.companyId}+${config.publicKey}:${config.privateKey}`;
    this.authHeader = `Basic ${Buffer.from(credentials).toString("base64")}`;
    this.clientId = config.clientId;
    // Append the standard API path if the URL doesn't already contain it
    this.apiBase = config.baseUrl.includes("/v4_6_release/")
      ? config.baseUrl.replace(/\/+$/, "")
      : `${config.baseUrl}/v4_6_release/apis/3.0`;
    this.rejectUnauthorized =
      process.env.CW_MANAGE_REJECT_UNAUTHORIZED !== "false";
  }

  private defaultHeaders(): Record<string, string> {
    return {
      Authorization: this.authHeader,
      clientId: this.clientId,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Make a request to the ConnectWise Manage API.
   */
  async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | number | undefined>;
    },
  ): Promise<T> {
    const url = new URL(`${this.apiBase}${path}`);

    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    // For self-hosted instances with self-signed certificates
    const fetchOptions: RequestInit & { dispatcher?: unknown } = {
      method,
      headers: this.defaultHeaders(),
    };

    if (options?.body !== undefined) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    // Node 18+ supports rejecting unauthorized via the global agent or
    // environment variable NODE_TLS_REJECT_UNAUTHORIZED. We set it here
    // so callers don't have to worry about it.
    const prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (!this.rejectUnauthorized) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    try {
      const response = await fetch(url.toString(), fetchOptions);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `ConnectWise API ${method} ${path} returned ${response.status}: ${errorBody}`,
        );
      }

      // Some endpoints return 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } finally {
      if (!this.rejectUnauthorized) {
        if (prevTls === undefined) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        } else {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls;
        }
      }
    }
  }

  /** GET helper */
  async get<T = unknown>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    return this.request<T>("GET", path, { params });
  }

  /** POST helper */
  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, { body });
  }

  /** PATCH helper */
  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, { body });
  }
}
