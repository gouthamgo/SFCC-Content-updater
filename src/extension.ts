import * as vscode from 'vscode';
import { ConfigService } from './services/config.service';
import { CredentialService } from './services/credential.service';
import { AuthService } from './services/auth.service';
import { ContentAssetService } from './services/content.service';
import {
  ContentTreeProvider,
  ContentAssetTreeItem
} from './providers/contentTree.provider';
import { EmptyTreeProvider } from './providers/emptyTree.provider';
import { ContentAsset, ContentAssetMetadata } from './models/config.model';

// Global services
let configService: ConfigService;
let credentialService: CredentialService;
let authService: AuthService;
let contentService: ContentAssetService;
let contentTreeProvider: ContentTreeProvider | EmptyTreeProvider;
let statusBarItem: vscode.StatusBarItem;

// Track open documents and their associated assets
const documentAssetMap = new Map<string, ContentAsset>();
const dirtyDocuments = new Set<string>();

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('SFCC Content Updater is activating...');

  // Initialize services
  CredentialService.init(context);
  credentialService = CredentialService.getInstance();
  configService = ConfigService.getInstance();

  // Register commands first (they can be called even if config fails)
  registerCommands(context);

  // Try to initialize extension (may fail if not configured)
  await initializeExtension(context);
}

/**
 * Initialize the extension with SFCC connection
 */
async function initializeExtension(
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    const config = await configService.loadConfig();

    // Initialize authentication service
    authService = new AuthService(config);

    // Initialize content service
    contentService = new ContentAssetService(config, authService);

    // Initialize tree view
    const realTreeProvider = new ContentTreeProvider(contentService);
    vscode.window.registerTreeDataProvider(
      'sfccContentAssets',
      realTreeProvider
    );
    contentTreeProvider = realTreeProvider;

    // Test connection
    await testConnection();

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    statusBarItem.text = '$(cloud) SFCC';
    statusBarItem.tooltip = `Connected to ${config.hostname}`;
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Register document change listeners
    registerDocumentListeners(context);

    vscode.window.showInformationMessage(
      `✅ SFCC Content Updater connected to ${config.hostname}`
    );
  } catch (error: any) {
    console.error('Failed to initialize SFCC connection:', error);

    // Show helpful error message based on the error
    let errorMessage = error.message;
    let showConfigureButton = false;

    if (
      error.message.includes('Missing SFCC configuration') ||
      error.message.includes('credentials')
    ) {
      errorMessage = '⚙️ Configure SFCC Connection';
      showConfigureButton = true;
    }

    // Register empty tree view
    const emptyTreeProvider = new EmptyTreeProvider(
      errorMessage,
      showConfigureButton
    );
    vscode.window.registerTreeDataProvider(
      'sfccContentAssets',
      emptyTreeProvider
    );
    contentTreeProvider = emptyTreeProvider;

    // Only show notification if it's a real error (not just "not configured")
    if (!showConfigureButton) {
      vscode.window.showErrorMessage(`SFCC: ${error.message}`);
    }
  }
}

/**
 * Test connection to SFCC
 */
async function testConnection(): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Connecting to SFCC...',
      cancellable: false
    },
    async (progress) => {
      progress.report({ increment: 50 });

      try {
        await contentService.testConnection();
        progress.report({ increment: 100 });
      } catch (error: any) {
        console.error('SFCC connection test failed:', error);
        // Re-throw with preserved error message
        throw error;
      }
    }
  );
}

/**
 * Configure SFCC connection with multi-step input
 */
async function configureConnection(
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    // Step 1: Hostname
    const hostname = await vscode.window.showInputBox({
      prompt: 'Enter SFCC hostname (without https://)',
      placeHolder: 'mysite-001.sandbox.us01.dx.commercecloud.salesforce.com',
      validateInput: (value) => {
        if (!value) {
          return 'Hostname is required';
        }
        if (value.includes('://')) {
          return "Don't include protocol (http:// or https://)";
        }
        return null;
      }
    });

    if (!hostname) {
      return; // User cancelled
    }

    // Step 2: Content Library
    const library = await vscode.window.showInputBox({
      prompt: 'Enter content library ID',
      placeHolder: 'shared_library',
      value: 'shared_library'
    });

    if (!library) {
      return;
    }

    // Step 3: Client ID (from Account Manager)
    const clientId = await vscode.window.showInputBox({
      prompt: 'Enter OCAPI Client ID (from Account Manager → API Client)',
      placeHolder: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      validateInput: (value) => {
        if (!value) {
          return 'Client ID is required';
        }
        return null;
      }
    });

    if (!clientId) {
      return;
    }

    // Step 4: Client Secret (from Account Manager)
    const clientSecret = await vscode.window.showInputBox({
      prompt:
        'Enter OCAPI Client Secret (password set when creating API Client)',
      password: true,
      placeHolder: '(hidden)',
      validateInput: (value) => {
        if (!value) {
          return 'Client Secret is required';
        }
        return null;
      }
    });

    if (!clientSecret) {
      return;
    }

    // Save to workspace settings (non-sensitive)
    const workspaceConfig = vscode.workspace.getConfiguration(
      'sfccContentUpdater'
    );
    await workspaceConfig.update(
      'hostname',
      hostname,
      vscode.ConfigurationTarget.Workspace
    );
    await workspaceConfig.update(
      'contentLibrary',
      library,
      vscode.ConfigurationTarget.Workspace
    );

    // Save to SecretStorage (sensitive)
    await credentialService.storeCredentials({
      clientId,
      clientSecret
    });

    vscode.window.showInformationMessage(
      '✅ SFCC credentials saved! Connecting to SFCC...'
    );

    // Reinitialize extension with new config
    await initializeExtension(context);
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `Failed to configure SFCC: ${error.message}`
    );
  }
}

/**
 * Clear stored credentials
 */
async function clearCredentials(
  context: vscode.ExtensionContext
): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    'This will clear all stored SFCC credentials. Continue?',
    'Clear',
    'Cancel'
  );

  if (confirm === 'Clear') {
    await credentialService.clearCredentials();
    vscode.window.showInformationMessage('SFCC credentials cleared');

    // Show empty tree with setup message
    const emptyTreeProvider = new EmptyTreeProvider(
      'Run "SFCC: Configure Connection" to set up',
      false
    );
    vscode.window.registerTreeDataProvider(
      'sfccContentAssets',
      emptyTreeProvider
    );
    contentTreeProvider = emptyTreeProvider;
  }
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // Configure connection
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'sfccContentUpdater.configure',
      async () => {
        await configureConnection(context);
      }
    )
  );

  // Clear credentials
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'sfccContentUpdater.clearCredentials',
      async () => {
        await clearCredentials(context);
      }
    )
  );

  // Refresh tree view
  context.subscriptions.push(
    vscode.commands.registerCommand('sfccContentUpdater.refresh', async () => {
      if (contentTreeProvider) {
        contentTreeProvider.refresh();
        vscode.window.showInformationMessage('Content assets refreshed');
      }
    })
  );

  // Open content asset
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'sfccContentUpdater.openAsset',
      async (asset: ContentAssetMetadata) => {
        await openContentAsset(asset);
      }
    )
  );

  // Push to SFCC
  context.subscriptions.push(
    vscode.commands.registerCommand('sfccContentUpdater.push', async () => {
      await pushCurrentDocument();
    })
  );

  // Pull from SFCC (re-fetch current asset)
  context.subscriptions.push(
    vscode.commands.registerCommand('sfccContentUpdater.pull', async () => {
      await pullCurrentDocument();
    })
  );
}

/**
 * Register document change listeners
 */
function registerDocumentListeners(context: vscode.ExtensionContext): void {
  // Track document changes (mark as dirty)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const uri = event.document.uri.toString();
      if (documentAssetMap.has(uri)) {
        dirtyDocuments.add(uri);
        updateStatusBar('$(warning) Unsaved changes - Push to SFCC');
      }
    })
  );

  // Clean up when document is closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      const uri = document.uri.toString();
      documentAssetMap.delete(uri);
      dirtyDocuments.delete(uri);
      updateStatusBar('$(cloud) SFCC');
    })
  );
}

/**
 * Open a content asset in the editor
 */
async function openContentAsset(
  assetMetadata: ContentAssetMetadata
): Promise<void> {
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Loading ${assetMetadata.id}...`,
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 50 });

        // Fetch full content asset
        const fullAsset = await contentService.getContentAsset(assetMetadata.id);

        progress.report({ increment: 75 });

        // Get content body
        const content = fullAsset.c_body || '';

        // Create untitled document with HTML language
        const doc = await vscode.workspace.openTextDocument({
          content: content,
          language: 'html'
        });

        // Track the document-asset mapping
        documentAssetMap.set(doc.uri.toString(), fullAsset);

        // Show the document
        await vscode.window.showTextDocument(doc);

        progress.report({ increment: 100 });

        updateStatusBar(`$(check) Loaded ${assetMetadata.id}`);
      }
    );
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `Failed to open ${assetMetadata.id}: ${error.message}`
    );
  }
}

/**
 * Push current document to SFCC
 */
async function pushCurrentDocument(): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const uri = editor.document.uri.toString();
  const asset = documentAssetMap.get(uri);

  if (!asset) {
    vscode.window.showWarningMessage(
      'This is not an SFCC content asset. Open a content asset from the sidebar first.'
    );
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Pushing ${asset.id} to SFCC...`,
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 50 });

        // Get current content from editor
        const currentContent = editor.document.getText();

        // Use PATCH to only update c_body
        await contentService.patchContentAsset(asset.id, {
          c_body: currentContent
        });

        // Mark as clean
        dirtyDocuments.delete(uri);

        progress.report({ increment: 100 });

        updateStatusBar(`$(check) Pushed ${asset.id}`);

        vscode.window.showInformationMessage(
          `✅ Successfully pushed ${asset.id} to SFCC`
        );
      }
    );
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `❌ Failed to push ${asset.id}: ${error.message}`
    );
  }
}

/**
 * Pull latest version from SFCC
 */
async function pullCurrentDocument(): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const uri = editor.document.uri.toString();
  const asset = documentAssetMap.get(uri);

  if (!asset) {
    vscode.window.showWarningMessage('This is not an SFCC content asset');
    return;
  }

  // Warn if there are unsaved changes
  if (dirtyDocuments.has(uri)) {
    const answer = await vscode.window.showWarningMessage(
      `You have unsaved changes to ${asset.id}. Pull latest from SFCC will overwrite your changes. Continue?`,
      'Pull Anyway',
      'Cancel'
    );

    if (answer !== 'Pull Anyway') {
      return;
    }
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Pulling ${asset.id} from SFCC...`,
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 50 });

        // Fetch latest version
        const freshAsset = await contentService.getContentAsset(asset.id);

        // Update the document
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(editor.document.getText().length)
        );
        edit.replace(
          editor.document.uri,
          fullRange,
          freshAsset.c_body || ''
        );

        await vscode.workspace.applyEdit(edit);

        // Update mapping
        documentAssetMap.set(uri, freshAsset);
        dirtyDocuments.delete(uri);

        progress.report({ increment: 100 });

        updateStatusBar(`$(check) Pulled ${asset.id}`);

        vscode.window.showInformationMessage(
          `✅ Pulled latest version of ${asset.id}`
        );
      }
    );
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `❌ Failed to pull ${asset.id}: ${error.message}`
    );
  }
}

/**
 * Update status bar
 */
function updateStatusBar(text: string): void {
  if (statusBarItem) {
    statusBarItem.text = text;

    // Auto-reset after 5 seconds
    setTimeout(() => {
      if (statusBarItem) {
        statusBarItem.text = '$(cloud) SFCC';
      }
    }, 5000);
  }
}

/**
 * Extension deactivation
 */
export function deactivate() {
  console.log('SFCC Content Updater is deactivating...');
}
