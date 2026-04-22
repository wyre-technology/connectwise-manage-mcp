#!/usr/bin/env node
/**
 * ConnectWise Manage MCP Server
 *
 * Provides MCP tools for interacting with the ConnectWise Manage (PSA) REST API.
 * Supports both cloud-hosted and self-hosted ConnectWise Manage instances.
 *
 * Required environment variables:
 *   CW_MANAGE_COMPANY_ID        - Your ConnectWise company identifier
 *   CW_MANAGE_PUBLIC_KEY        - API member public key
 *   CW_MANAGE_PRIVATE_KEY       - API member private key
 *   CW_MANAGE_CLIENT_ID         - Client ID from ConnectWise Developer Portal
 *
 * Optional environment variables:
 *   CW_MANAGE_URL               - API base URL (default: https://api-na.myconnectwise.net)
 *                                  Cloud: api-na.myconnectwise.net, api-eu.myconnectwise.net, api-au.myconnectwise.net
 *                                  Self-hosted: https://cwm.yourcompany.com (or with full path)
 *   CW_MANAGE_REJECT_UNAUTHORIZED - Set to "false" for self-signed certs (default: "true")
 *   MCP_TRANSPORT               - "stdio" (default) or "http"
 *   MCP_HTTP_PORT               - HTTP port (default: 8080)
 *   MCP_HTTP_HOST               - HTTP host (default: 0.0.0.0)
 *   AUTH_MODE                   - "env" (default) or "gateway" for header-based auth
 */

import {
  createServer,
  IncomingMessage,
  ServerResponse,
  Server as HttpServer,
} from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { getConfig, CwManageClient } from "./api-client.js";
import { registerTicketTools } from "./tools/tickets.js";
import { registerCompanyTools } from "./tools/companies.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerTimeEntryTools } from "./tools/time-entries.js";
import { registerMemberTools } from "./tools/members.js";
import { registerConfigurationTools } from "./tools/configurations.js";
import { registerServiceTools } from "./tools/service.js";
import { registerActivityTools } from "./tools/activities.js";
import { registerCatalogTools } from "./tools/catalog.js";
import { registerHealthTools } from "./tools/health.js";

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "connectwise-manage-mcp",
    version: "1.1.5",
  });

  const config = getConfig();

  if (!config) {
    // Register a single diagnostic tool so the client gets a clear error
    server.tool(
      "cw_test_connection",
      "Test the connection to ConnectWise Manage.",
      {},
      async () => ({
        content: [
          {
            type: "text",
            text: [
              "Error: Missing ConnectWise Manage credentials.",
              "",
              "Required environment variables:",
              "  CW_MANAGE_COMPANY_ID        - Your ConnectWise company identifier",
              "  CW_MANAGE_PUBLIC_KEY        - API member public key",
              "  CW_MANAGE_PRIVATE_KEY       - API member private key",
              "  CW_MANAGE_CLIENT_ID         - Client ID from ConnectWise Developer Portal",
              "",
              "Optional:",
              "  CW_MANAGE_URL               - API base URL",
              "    Cloud:       https://api-na.myconnectwise.net (default)",
              "                 https://api-eu.myconnectwise.net",
              "                 https://api-au.myconnectwise.net",
              "    Self-hosted: https://cwm.yourcompany.com",
              "  CW_MANAGE_REJECT_UNAUTHORIZED - Set to 'false' for self-signed certs",
            ].join("\n"),
          },
        ],
        isError: true,
      }),
    );
    return server;
  }

  const client = new CwManageClient(config);

  registerTicketTools(server, client);
  registerCompanyTools(server, client);
  registerContactTools(server, client);
  registerProjectTools(server, client);
  registerTimeEntryTools(server, client);
  registerMemberTools(server, client);
  registerConfigurationTools(server, client);
  registerServiceTools(server, client);
  registerActivityTools(server, client);
  registerCatalogTools(server, client);
  registerHealthTools(server, client);

  return server;
}

// ---------------------------------------------------------------------------
// Transport: stdio
// ---------------------------------------------------------------------------

async function startStdioTransport(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ConnectWise Manage MCP server running on stdio");
}

// ---------------------------------------------------------------------------
// Transport: HTTP (StreamableHTTPServerTransport)
// ---------------------------------------------------------------------------

let httpServer: HttpServer | undefined;

async function startHttpTransport(): Promise<void> {
  const port = parseInt(process.env.MCP_HTTP_PORT || "8080", 10);
  const host = process.env.MCP_HTTP_HOST || "0.0.0.0";
  const authMode = process.env.AUTH_MODE || "env";
  const isGatewayMode = authMode === "gateway";

  httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(
      req.url || "/",
      `http://${req.headers.host || "localhost"}`,
    );

    // Health endpoint
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          transport: "http",
          authMode: isGatewayMode ? "gateway" : "env",
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    // MCP endpoint - stateless: fresh server + transport per request
    if (url.pathname === "/mcp") {
      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Method not allowed" },
            id: null,
          }),
        );
        return;
      }

      // In gateway mode, extract credentials from headers
      if (isGatewayMode) {
        const headers = req.headers as Record<
          string,
          string | string[] | undefined
        >;
        const companyId = headers["x-cw-company-id"] as string | undefined;
        const publicKey = headers["x-cw-public-key"] as string | undefined;
        const privateKey = headers["x-cw-private-key"] as string | undefined;
        const clientId = headers["x-cw-client-id"] as string | undefined;
        const baseUrl = headers["x-cw-url"] as string | undefined;

        if (!companyId || !publicKey || !privateKey || !clientId) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Missing credentials",
              message:
                "Gateway mode requires X-CW-Company-Id, X-CW-Public-Key, X-CW-Private-Key, and X-CW-Client-Id headers",
              required: [
                "X-CW-Company-Id",
                "X-CW-Public-Key",
                "X-CW-Private-Key",
                "X-CW-Client-Id",
              ],
            }),
          );
          return;
        }

        process.env.CW_MANAGE_COMPANY_ID = companyId;
        process.env.CW_MANAGE_PUBLIC_KEY = publicKey;
        process.env.CW_MANAGE_PRIVATE_KEY = privateKey;
        process.env.CW_MANAGE_CLIENT_ID = clientId;
        if (baseUrl) {
          process.env.CW_MANAGE_URL = baseUrl;
        }
      }

      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on("close", () => {
        transport.close();
        server.close();
      });

      server
        .connect(transport as unknown as Transport)
        .then(() => {
          transport.handleRequest(req, res);
        })
        .catch((err) => {
          console.error("MCP transport error:", err);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32603, message: "Internal error" },
                id: null,
              }),
            );
          }
        });

      return;
    }

    // 404 for everything else
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "Not found", endpoints: ["/mcp", "/health"] }),
    );
  });

  await new Promise<void>((resolve) => {
    httpServer!.listen(port, host, () => {
      console.error(
        `ConnectWise Manage MCP server listening on http://${host}:${port}/mcp`,
      );
      console.error(`Health check available at http://${host}:${port}/health`);
      console.error(
        `Authentication mode: ${isGatewayMode ? "gateway (header-based)" : "env (environment variables)"}`,
      );
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function setupShutdownHandlers(): void {
  const shutdown = async () => {
    console.error("Shutting down ConnectWise Manage MCP server...");
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  setupShutdownHandlers();

  const transportType = process.env.MCP_TRANSPORT || "stdio";

  if (transportType === "http") {
    await startHttpTransport();
  } else {
    await startStdioTransport();
  }
}

main().catch(console.error);
