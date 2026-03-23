# ConnectWise Manage MCP Server

A Model Context Protocol (MCP) server for ConnectWise Manage (PSA), providing ticket management, company operations, contact management, project tracking, time entry functionality, and more.

Supports **cloud-hosted** and **self-hosted** ConnectWise Manage instances.

## One-Click Deployment

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/wyre-technology/connectwise-manage-mcp/tree/main)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wyre-technology/connectwise-manage-mcp)

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CW_MANAGE_COMPANY_ID` | Yes | Your ConnectWise company identifier |
| `CW_MANAGE_PUBLIC_KEY` | Yes | API member public key |
| `CW_MANAGE_PRIVATE_KEY` | Yes | API member private key |
| `CW_MANAGE_CLIENT_ID` | Yes | Client ID from [ConnectWise Developer Portal](https://developer.connectwise.com/) |
| `CW_MANAGE_URL` | No | API base URL (see below) |
| `CW_MANAGE_REJECT_UNAUTHORIZED` | No | Set to `false` for self-signed certs (default: `true`) |
| `MCP_TRANSPORT` | No | `stdio` (default) or `http` |
| `MCP_HTTP_PORT` | No | HTTP port (default: `8080`) |
| `AUTH_MODE` | No | `env` (default) or `gateway` for header-based auth |

### API Base URL (`CW_MANAGE_URL`)

| Instance Type | URL |
|---------------|-----|
| Cloud (North America) | `https://api-na.myconnectwise.net` (default) |
| Cloud (Europe) | `https://api-eu.myconnectwise.net` |
| Cloud (Australia) | `https://api-au.myconnectwise.net` |
| **Self-hosted** | `https://cwm.yourcompany.com` |

For self-hosted instances, set `CW_MANAGE_URL` to your server's base URL. The server automatically appends `/v4_6_release/apis/3.0` unless the URL already contains that path.

If your self-hosted instance uses a self-signed certificate, also set `CW_MANAGE_REJECT_UNAUTHORIZED=false`.

### Getting Your API Keys

1. Log in to your ConnectWise Manage instance
2. Navigate to **System > Members > API Members**
3. Create a new API member with appropriate permissions
4. Generate API keys for the member
5. Get your Client ID from the [ConnectWise Developer Portal](https://developer.connectwise.com/)

## Available Tools

### Tickets
- `cw_search_tickets` — Search service tickets with conditions
- `cw_get_ticket` — Get a ticket by ID
- `cw_create_ticket` — Create a new service ticket
- `cw_update_ticket` — Update a ticket (JSON Patch)

### Companies
- `cw_search_companies` — Search companies
- `cw_get_company` — Get a company by ID
- `cw_create_company` — Create a new company
- `cw_update_company` — Update a company (JSON Patch)

### Contacts
- `cw_search_contacts` — Search contacts
- `cw_get_contact` — Get a contact by ID
- `cw_create_contact` — Create a new contact

### Projects
- `cw_search_projects` — Search projects
- `cw_get_project` — Get a project by ID
- `cw_create_project` — Create a new project

### Time Entries
- `cw_search_time_entries` — Search time entries
- `cw_get_time_entry` — Get a time entry by ID
- `cw_create_time_entry` — Create a new time entry

### Members
- `cw_search_members` — Search members/technicians
- `cw_get_member` — Get a member by ID

### Configuration Items
- `cw_search_configurations` — Search configuration items (assets)
- `cw_get_configuration` — Get a configuration item by ID

### Service Reference Data
- `cw_list_boards` — List service boards
- `cw_list_priorities` — List ticket priorities
- `cw_list_statuses` — List statuses for a board

### Activities
- `cw_search_activities` — Search activities
- `cw_get_activity` — Get an activity by ID
- `cw_create_activity` — Create a new activity

### Health
- `cw_test_connection` — Test connection (hits `/system/info`)

## Usage

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "connectwise-manage": {
      "command": "npx",
      "args": ["@wyre-technology/connectwise-manage-mcp"],
      "env": {
        "CW_MANAGE_COMPANY_ID": "your-company-id",
        "CW_MANAGE_PUBLIC_KEY": "your-public-key",
        "CW_MANAGE_PRIVATE_KEY": "your-private-key",
        "CW_MANAGE_CLIENT_ID": "your-client-id"
      }
    }
  }
}
```

For a self-hosted instance:

```json
{
  "mcpServers": {
    "connectwise-manage": {
      "command": "npx",
      "args": ["@wyre-technology/connectwise-manage-mcp"],
      "env": {
        "CW_MANAGE_URL": "https://cwm.yourcompany.com",
        "CW_MANAGE_COMPANY_ID": "your-company-id",
        "CW_MANAGE_PUBLIC_KEY": "your-public-key",
        "CW_MANAGE_PRIVATE_KEY": "your-private-key",
        "CW_MANAGE_CLIENT_ID": "your-client-id",
        "CW_MANAGE_REJECT_UNAUTHORIZED": "false"
      }
    }
  }
}
```

### With Docker

```bash
docker compose up -d
```

### HTTP Transport (Gateway Mode)

Run with HTTP transport for multi-tenant gateway deployments:

```bash
MCP_TRANSPORT=http AUTH_MODE=gateway node dist/index.js
```

Pass credentials per-request via headers: `X-CW-Company-Id`, `X-CW-Public-Key`, `X-CW-Private-Key`, `X-CW-Client-Id`, and optionally `X-CW-URL`.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev

# Type check
npm run typecheck

# Run tests
npm test
```

## License

Apache-2.0
