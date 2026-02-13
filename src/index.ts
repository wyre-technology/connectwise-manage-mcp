#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "connectwise-manage-mcp",
  version: "0.1.0",
});

// TODO: Register ConnectWise Manage tools (tickets, companies, contacts, projects, time entries)

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
