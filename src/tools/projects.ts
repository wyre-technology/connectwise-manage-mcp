import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

export function registerProjectTools(server: McpServer, client: CwManageClient) {
  server.tool(
    "cw_search_projects",
    "Search projects in ConnectWise Manage.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/project/projects", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_project",
    "Get a specific project by ID.",
    {
      id: z.number().describe("Project ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/project/projects/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_project_ticket_notes",
    "Get all notes on a project ticket, including notes from any child tickets.",
    {
      id: z.number().describe("Project ticket ID"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ id, page, pageSize }) => {
      const result = await client.get(`/project/tickets/${id}/allNotes`, {
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_add_project_ticket_note",
    "Add a note to a project ticket. Use internalAnalysisFlag for internal-only notes or resolutionFlag for resolution notes. Defaults to a plain discussion note.",
    {
      id: z.number().describe("Project ticket ID"),
      text: z.string().describe("Note text content"),
      detailDescriptionFlag: z.boolean().optional().describe("Add as detail description (default: false)"),
      internalAnalysisFlag: z.boolean().optional().describe("Mark as internal analysis only (default: false)"),
      resolutionFlag: z.boolean().optional().describe("Mark as resolution note (default: false)"),
    },
    async ({ id, text, detailDescriptionFlag, internalAnalysisFlag, resolutionFlag }) => {
      const body: Record<string, unknown> = { text };
      if (detailDescriptionFlag !== undefined) body.detailDescriptionFlag = detailDescriptionFlag;
      if (internalAnalysisFlag !== undefined) body.internalAnalysisFlag = internalAnalysisFlag;
      if (resolutionFlag !== undefined) body.resolutionFlag = resolutionFlag;

      const result = await client.post(`/project/tickets/${id}/notes`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_project",
    "Create a new project.",
    {
      name: z.string().describe("Project name"),
      boardId: z.number().describe("Project board ID"),
      companyId: z.number().describe("Company ID"),
      estimatedStart: z.string().optional().describe("Estimated start date (ISO 8601)"),
      estimatedEnd: z.string().optional().describe("Estimated end date (ISO 8601)"),
      description: z.string().optional().describe("Project description"),
      managerId: z.number().optional().describe("Project manager member ID"),
    },
    async ({ name, boardId, companyId, estimatedStart, estimatedEnd, description, managerId }) => {
      const body: Record<string, unknown> = {
        name,
        board: { id: boardId },
        company: { id: companyId },
      };
      if (estimatedStart) body.estimatedStart = estimatedStart;
      if (estimatedEnd) body.estimatedEnd = estimatedEnd;
      if (description) body.description = description;
      if (managerId) body.manager = { id: managerId };

      const result = await client.post("/project/projects", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
