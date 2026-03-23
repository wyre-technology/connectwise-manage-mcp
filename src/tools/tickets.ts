import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

export function registerTicketTools(server: McpServer, client: CwManageClient) {
  server.tool(
    "cw_search_tickets",
    "Search service tickets in ConnectWise Manage. Use 'conditions' for CW query syntax (e.g. \"status/name != 'Closed'\" or \"company/name = 'Acme'\").",
    {
      conditions: z
        .string()
        .optional()
        .describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z
        .number()
        .optional()
        .describe("Results per page (default: 25, max: 1000)"),
      orderBy: z
        .string()
        .optional()
        .describe("Field to order by (e.g. 'id desc')"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/service/tickets", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_ticket",
    "Get a specific service ticket by ID.",
    {
      id: z.number().describe("Ticket ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/service/tickets/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_ticket",
    "Create a new service ticket.",
    {
      summary: z.string().describe("Ticket summary/title"),
      boardId: z.number().optional().describe("Service board ID"),
      companyId: z.number().optional().describe("Company ID to associate"),
      contactId: z.number().optional().describe("Contact ID to associate"),
      statusId: z.number().optional().describe("Status ID"),
      priorityId: z.number().optional().describe("Priority ID"),
      typeId: z.number().optional().describe("Type ID"),
      subTypeId: z.number().optional().describe("SubType ID"),
      initialDescription: z.string().optional().describe("Initial ticket description"),
    },
    async ({ summary, boardId, companyId, contactId, statusId, priorityId, typeId, subTypeId, initialDescription }) => {
      const body: Record<string, unknown> = { summary };
      if (boardId) body.board = { id: boardId };
      if (companyId) body.company = { id: companyId };
      if (contactId) body.contact = { id: contactId };
      if (statusId) body.status = { id: statusId };
      if (priorityId) body.priority = { id: priorityId };
      if (typeId) body.type = { id: typeId };
      if (subTypeId) body.subType = { id: subTypeId };
      if (initialDescription) body.initialDescription = initialDescription;

      const result = await client.post("/service/tickets", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_ticket",
    "Update an existing service ticket using JSON Patch operations.",
    {
      id: z.number().describe("Ticket ID"),
      operations: z
        .array(
          z.object({
            op: z.enum(["replace", "add", "remove"]).describe("Patch operation"),
            path: z.string().describe("JSON path (e.g. 'status/id', 'summary')"),
            value: z.unknown().optional().describe("New value"),
          }),
        )
        .describe("Array of JSON Patch operations"),
    },
    async ({ id, operations }) => {
      const result = await client.patch(`/service/tickets/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
