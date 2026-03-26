# Azure AD App Registration Setup

This guide walks through creating the Entra ID (Azure AD) app registration required for the ConnectWise Manage MCP server's OAuth 2.1 authentication.

> **Before you start:** You need the Global Administrator or Application Administrator role in your Entra tenant to complete these steps.

---

## 1. Create the App Registration

1. Sign in to the [Azure Portal](https://portal.azure.com) and navigate to **Azure Active Directory** → **App registrations** → **New registration**
2. Fill in the form:
   - **Name:** `CWM-MCP-Server` (or any name you prefer)
   - **Supported account types:** `Accounts in this organizational directory only (Single tenant)`
   - **Redirect URI:** Leave blank for now — we'll add it in the next step
3. Click **Register**
4. Copy and save the following values from the **Overview** page — you'll need them in your `.env`:
   - **Application (client) ID** → `AZURE_CLIENT_ID`
   - **Directory (tenant) ID** → `AZURE_TENANT_ID`

---

## 2. Add the Redirect URI

> **Critical:** The redirect URI must be registered under **Mobile and desktop applications**, not Web or SPA. Web requires a client secret; SPA binds tokens to the browser origin. Both will break the OAuth flow.

1. In the app registration, go to **Authentication** → **Add a platform** → **Mobile and desktop applications**
2. Under **Custom redirect URIs**, enter:
   ```
   https://claude.ai/api/mcp/auth_callback
   ```
3. Click **Configure**

---

## 3. Enable Public Client Flows

Still on the **Authentication** page:

1. Scroll down to **Advanced settings**
2. Set **Allow public client flows** → **Yes**
3. Click **Save**

---

## 4. Update the Manifest

This step forces Azure AD to issue v2 tokens. Without it, tokens are issued in v1 format and issuer validation will fail silently.

1. Go to **Manifest** in the left sidebar
2. Find the `signInAudience` field and add `accessTokenAcceptedVersion` immediately after it:
   ```json
   "signInAudience": "AzureADMyOrg",
   "accessTokenAcceptedVersion": 2,
   ```
   > The value must be the number `2`, not the string `"2"`.
3. Click **Save**

---

## 5. Expose an API

This creates the `api://` audience that the server validates tokens against.

1. Go to **Expose an API** in the left sidebar
2. Next to **Application ID URI**, click **Add** → accept the default value `api://<your-client-id>` → **Save**
3. Under **Scopes defined by this API**, click **Add a scope**:
   - **Scope name:** `access_as_user`
   - **Who can consent:** `Admins and users`
   - **Admin consent display name:** `Access CWM MCP Server`
   - **Admin consent description:** `Allows the user to call the ConnectWise Manage MCP tools`
   - **State:** `Enabled`
4. Click **Add scope**
5. Copy the full scope URI (e.g. `api://<client-id>/access_as_user`) — you don't need this in `.env` but it's useful for reference
6. Set `AZURE_AUDIENCE` in your `.env` to:
   ```
   AZURE_AUDIENCE=api://<your-client-id>
   ```

---

## 6. Create an App Role

App roles let you restrict access to specific users or groups in your tenant.

1. Go to **App roles** in the left sidebar → **Create app role**
2. Fill in the form:
   - **Display name:** `CWM Access`
   - **Allowed member types:** `Users/Groups`
   - **Value:** `CWM.Access`
   - **Description:** `Grants access to the ConnectWise Manage MCP tools`
   - **Do you want to enable this app role?** → checked
3. Click **Apply**

---

## 7. Grant API Permissions

1. Go to **API permissions** in the left sidebar
2. Confirm the following **Microsoft Graph** delegated permissions are listed (they are usually pre-added):
   - `openid`
   - `profile`
   - `email`
3. If any are missing, click **Add a permission** → **Microsoft Graph** → **Delegated permissions** → search and add them
4. Click **Grant admin consent for \<your tenant\>** → **Yes**

---

## 8. Assign the App Role to Users or Groups

The app role created in Step 6 must be explicitly assigned — it isn't granted automatically to all tenant users.

1. Navigate to **Azure Active Directory** → **Enterprise applications** → search for `CWM-MCP-Server` → open it
2. Go to **Users and groups** → **Add user/group**
3. Select the users or security group that should have access
4. Under **Select a role**, choose **CWM Access**
5. Click **Assign**

---

## 9. Summary of Values for `.env`

After completing the steps above, your `.env` should have:

```env
AZURE_TENANT_ID=<Directory (tenant) ID from Overview>
AZURE_CLIENT_ID=<Application (client) ID from Overview>
AZURE_AUDIENCE=api://<Application (client) ID>
AZURE_REQUIRED_ROLE=CWM.Access
```

---

## Troubleshooting

**OAuth tab opens but Azure shows `AADSTS50011` (redirect URI mismatch)**
The redirect URI `https://claude.ai/api/mcp/auth_callback` is not registered, or it's registered under the wrong platform (Web or SPA instead of Mobile and desktop applications). Delete it from the wrong platform and re-add it under Mobile and desktop applications.

**Token validation fails — logs show audience mismatch**
Check the `[auth]` log line for `tokenAudience`. Set `AZURE_AUDIENCE` in `.env` to exactly match that value.
```bash
docker compose logs connectwise-manage-mcp | grep "\[auth\]"
```

**`AADSTS65001` — user has not consented / no role assigned**
The user hasn't been assigned the `CWM.Access` app role. Complete Step 8 above.

**`accessTokenAcceptedVersion` was not saved**
Go back to the Manifest and verify the field is present with value `2` (integer, not string). If Azure reset it during a save, re-add it.
