# SFCC Content Updater

> Update Salesforce Commerce Cloud (SFCC) content assets directly from VS Code

A VS Code extension that allows SFCC developers to browse, edit, and update content assets without leaving their IDE. No more switching between Business Manager and your editor!

## Features

- 📋 **Browse Content Assets** - View all content assets from your SFCC instance in a sidebar
- ✏️ **Edit with Full IDE Features** - Syntax highlighting, autocomplete, and all VS Code features
- 🔄 **Push & Pull** - Sync changes between your local editor and SFCC
- ⚡ **Fast Workflow** - Edit and push in seconds, not minutes
- 🎯 **Status Indicators** - Visual feedback for sync status
- 🔒 **OAuth Authentication** - Secure connection using OCAPI

## Prerequisites

Before using this extension, you need:

### 1. SFCC Instance Access
- Development, staging, or production SFCC instance
- Business Manager user account with Site Development rights

### 2. OCAPI Client ID
You must create an API Client in **Account Manager**:

1. Log into Account Manager (not Business Manager)
2. Go to **API Client** tab
3. Click **Add API Client**
4. Fill in:
   - **Display Name**: "VS Code Content Updater"
   - **Password**: Create a strong password (this is your client secret)
   - **Organizations**: Add your organization
   - **Roles**: Select "Salesforce Commerce API"
   - **Token Endpoint Auth Method**: `client_secret_basic`
5. Save and copy the generated **Client ID**

### 3. OCAPI Permissions
Configure OCAPI Data API permissions in **Business Manager**:

1. Go to `Administration > Site Development > Open Commerce API Settings`
2. Select Type: **Data API**
3. Select Context: **Global** (or specific site)
4. Add this configuration:

```json
{
  "_v": "23.2",
  "clients": [
    {
      "client_id": "YOUR_CLIENT_ID_HERE",
      "resources": [
        {
          "resource_id": "/libraries/*/content/*",
          "methods": ["get"],
          "read_attributes": "(**)",
          "write_attributes": "(**)"
        },
        {
          "resource_id": "/libraries/*/content",
          "methods": ["post", "put", "patch"],
          "read_attributes": "(**)",
          "write_attributes": "(**)"
        },
        {
          "resource_id": "/libraries/*",
          "methods": ["get"],
          "read_attributes": "(**)",
          "write_attributes": "(**)"
        }
      ]
    }
  ]
}
```

   **Note:** The `*` wildcard in `/libraries/*/content/*` means this configuration works for **all libraries** (e.g., `shared_library`, `SiteGenesis`, etc.). You don't need to change this even if your library name is different.

## Installation

### From Source (Development)

1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/SFCC-Content-updater.git
   cd SFCC-Content-updater
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile TypeScript:
   ```bash
   npm run compile
   ```

4. Press `F5` in VS Code to launch Extension Development Host

### From VSIX (Coming Soon)

Once published, you can install from the VS Code Marketplace.

## Setup

1. **Create dw.json in your workspace root:**

   Copy `dw.json.example` to `dw.json`:
   ```bash
   cp dw.json.example dw.json
   ```

2. **Fill in your credentials:**

   **IMPORTANT:** This `dw.json` is for the SFCC Content Updater extension and is DIFFERENT from the standard Prophet extension `dw.json`. Do NOT use `code-version` or `cartridge` fields.

   ```json
   {
     "hostname": "dev01-realm-customer.demandware.net",
     "username": "your-business-manager-username",
     "password": "your-access-key",
     "clientId": "your-ocapi-client-id",
     "clientSecret": "your-ocapi-client-secret",
     "contentLibrary": "shared_library"
   }
   ```

   **Required fields:**
   - `hostname` - Your SFCC instance hostname (NO https:// prefix)
   - `username` - Business Manager username
   - `password` - Access key from Business Manager
   - `clientId` - OCAPI Client ID from Account Manager
   - `clientSecret` - OCAPI Client Secret (the password you set when creating API Client)
   - `contentLibrary` - Content library ID (see below how to find it)

   **How to find your Content Library ID:**
   - In Business Manager, go to: **Merchant Tools > Content > Libraries**
   - You'll see a list of libraries (e.g., `shared_library`, `SiteGenesis`, etc.)
   - Copy the **exact ID** (case-sensitive) of the library you want to work with
   - Or navigate to: **Merchant Tools > Content > Content Assets**
   - Click on the library you use (e.g., `shared_library`)
   - The library ID will be in the breadcrumb: **Libraries > `shared_library` > Content**

   **Important:** Add `dw.json` to your `.gitignore` to protect your credentials!

3. **Reload VS Code:**
   - Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
   - Type "Reload Window"

4. **Check the sidebar:**
   - You should see a new "SFCC Content" icon in the activity bar
   - Click it to view your content assets

## Usage

### Browse Content Assets

1. Click the "SFCC Content" icon in the sidebar
2. View all content assets from your configured library
3. Green globe icon = online, gray icon = offline

### Edit a Content Asset

1. Click on any content asset in the tree view
2. The asset opens in the editor with HTML syntax highlighting
3. Make your changes

### Push Changes to SFCC

**Option 1:** Use keyboard shortcut
- Press `Ctrl+Shift+U` (Windows/Linux) or `Cmd+Shift+U` (Mac)

**Option 2:** Use button
- Click the cloud upload icon in the editor toolbar

**Option 3:** Use command palette
- Press `Ctrl+Shift+P` / `Cmd+Shift+P`
- Type "SFCC: Push to SFCC"

### Pull Latest from SFCC

If someone else edited the content asset:

1. Open the asset
2. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
3. Type "SFCC: Pull from SFCC"
4. Latest version replaces your local copy

### Refresh Asset List

Click the refresh icon in the tree view header to reload the content asset list.

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `SFCC: Refresh Content Assets` | - | Reload the content asset tree |
| `SFCC: Push to SFCC` | `Ctrl+Shift+U` | Upload current document to SFCC |
| `SFCC: Pull from SFCC` | - | Download latest version from SFCC |

## Status Bar

The status bar shows the current state:
- `$(cloud) SFCC` - Connected and ready
- `$(warning) Unsaved changes` - You have local edits not pushed
- `$(check) Pushed {id}` - Successfully uploaded
- `$(check) Pulled {id}` - Successfully downloaded

## Troubleshooting

### "dw.json not found"
- Make sure `dw.json` exists in your workspace root folder
- Check that it's valid JSON with all required fields

### "Authentication failed"
- Verify your `clientId` and `clientSecret` are correct
- Check that your API Client exists in Account Manager
- Ensure your API Client has the correct roles

### "Permission denied"
- Check OCAPI permissions in Business Manager
- Make sure your Client ID is added to the OCAPI settings
- Verify the resource paths and methods are configured

### "Cannot reach SFCC instance"
- Check your `hostname` in dw.json (no http:// prefix)
- Verify your network connection
- Check if the SFCC instance is up

### "Content asset is locked"
- Another user may be editing the asset
- Try again in a few minutes
- Check in Business Manager if the asset is locked

## Configuration Reference

### dw.json Fields

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `hostname` | Yes | SFCC instance hostname (NO http:// or https://) | `dev01-realm-customer.demandware.net` |
| `username` | Yes | Business Manager username | `user@example.com` |
| `password` | Yes | Business Manager access key | `your-access-key` |
| `clientId` | Yes | OCAPI Client ID from Account Manager | `aaaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee` |
| `clientSecret` | Yes | OCAPI Client Secret (password from API Client) | `your-client-password` |
| `contentLibrary` | Yes | Content library ID from Merchant Tools > Content > Libraries | `shared_library` |

**Note:** Do NOT include `code-version`, `cartridge`, `version`, or other Prophet extension fields. This extension uses OCAPI, not WebDAV.

## Roadmap

Future features planned:

- [ ] Image upload and management
- [ ] Create new content assets
- [ ] Delete content assets
- [ ] Search and filter
- [ ] Multi-library support
- [ ] Diff view (local vs SFCC)
- [ ] Content asset templates
- [ ] Multi-environment sync (DEV/STG/PROD)
- [ ] Conflict resolution
- [ ] Batch operations

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Security

**Never commit your `dw.json` file!** It contains sensitive credentials.

Add to your `.gitignore`:
```
dw.json
```

## License

MIT

## Support

- Report bugs: [GitHub Issues](https://github.com/your-username/SFCC-Content-updater/issues)
- SFCC Documentation: [Salesforce Commerce Cloud](https://documentation.b2c.commercecloud.salesforce.com/)
- OCAPI Documentation: [Open Commerce API](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/)

## Credits

Built with ❤️ for the SFCC developer community

---

**Happy coding!** 🚀
