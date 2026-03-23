import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

export function registerHealthTools(server: McpServer, client: CwManageClient) {
  server.tool(
    "cw_test_connection",
    "Test the connection to ConnectWise Manage by fetching system info. Returns API version and licensing details.",
    {},
    async () => {
      const result = await client.get("/system/info");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
