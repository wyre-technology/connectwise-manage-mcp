# ConnectWise Manage MCP Server

A Model Context Protocol (MCP) server for ConnectWise Manage (PSA), providing ticket management, company operations, contact management, project tracking, and time entry functionality.

## One-Click Deployment

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/wyre-technology/connectwise-manage-mcp/tree/main)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wyre-technology/connectwise-manage-mcp)

## Configuration

Set the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `CW_MANAGE_COMPANY_ID` | Yes | Your ConnectWise company identifier |
| `CW_MANAGE_PUBLIC_KEY` | Yes | API public key |
| `CW_MANAGE_PRIVATE_KEY` | Yes | API private key |
| `CW_MANAGE_CLIENT_ID` | Yes | API client ID |

### Getting Your API Keys

1. Log in to your ConnectWise Manage instance
2. Navigate to System > Members > API Members
3. Create a new API member with appropriate permissions
4. Generate API keys for the member

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

### With Docker

```bash
docker compose up -d
```

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
```

## License

Apache-2.0
