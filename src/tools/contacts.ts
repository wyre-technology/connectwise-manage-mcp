import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

export function registerContactTools(server: McpServer, client: CwManageClient) {
  server.tool(
    "cw_search_contacts",
    "Search contacts in ConnectWise Manage. Use 'conditions' for CW query syntax (e.g. \"firstName = 'John'\").",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/company/contacts", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_contact",
    "Get a specific contact by ID.",
    {
      id: z.number().describe("Contact ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/company/contacts/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_contact",
    "Create a new contact.",
    {
      firstName: z.string().describe("First name"),
      lastName: z.string().describe("Last name"),
      companyId: z.number().describe("Company ID to associate the contact with"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      title: z.string().optional().describe("Job title"),
    },
    async ({ firstName, lastName, companyId, email, phone, title }) => {
      const body: Record<string, unknown> = {
        firstName,
        lastName,
        company: { id: companyId },
      };
      if (title) body.title = title;

      // CW Manage uses communicationItems for email/phone
      const comms: Array<Record<string, unknown>> = [];
      if (email) {
        comms.push({ type: { name: "Email" }, value: email, communicationType: "Email" });
      }
      if (phone) {
        comms.push({ type: { name: "Direct" }, value: phone, communicationType: "Phone" });
      }
      if (comms.length) body.communicationItems = comms;

      const result = await client.post("/company/contacts", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
