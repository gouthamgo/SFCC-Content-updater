import * as vscode from 'vscode';
import { ConfigService } from './services/config.service';
import { AuthService } from './services/auth.service';
import { ContentAssetService } from './services/content.service';
import {
  ContentTreeProvider,
  ContentAssetTreeItem
} from './providers/contentTree.provider';
import { ContentAsset, ContentAssetMetadata } from './models/config.model';

// Global services
let configService: ConfigService;
let authService: AuthService;
let contentService: ContentAssetService;
let contentTreeProvider: ContentTreeProvider;
let statusBarItem: vscode.StatusBarItem;

// Track open documents and their associated assets
const documentAssetMap = new Map<string, ContentAsset>();
const dirtyDocuments = new Set<string>();

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('SFCC Content Updater is activating...');

  try {
    // Initialize configuration service
    configService = ConfigService.getInstance();

    // Try to load configuration
    try {
      const config = await configService.loadConfig();

      // Initialize authentication service
      authService = new AuthService(config);

      // Initialize content service
      contentService = new ContentAssetService(config, authService);

      // Test connection
      await testConnection();

      // Initialize tree view
      contentTreeProvider = new ContentTreeProvider(contentService);
      vscode.window.registerTreeDataProvider(
        'sfccContentAssets',
        contentTreeProvider
      );

      // Create status bar item
      statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
      );
      statusBarItem.text = '$(cloud) SFCC';
      statusBarItem.tooltip = `Connected to ${config.hostname}`;
      statusBarItem.show();
      context.subscriptions.push(statusBarItem);

      // Register all commands
      registerCommands(context);

      // Register document change listeners
      registerDocumentListeners(context);

      vscode.window.showInformationMessage(
        `✅ SFCC Content Updater connected to ${config.hostname}`
      );
    } catch (error: any) {
      // Configuration error - show but don't crash
      vscode.window.showWarningMessage(
        `SFCC Content Updater: ${error.message}`
      );
    }
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `Failed to activate SFCC Content Updater: ${error.message}`
    );
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

      const isConnected = await contentService.testConnection();

      if (!isConnected) {
        throw new Error(
          'Failed to connect to SFCC. Please check your credentials and OCAPI permissions.'
        );
      }

      progress.report({ increment: 100 });
    }
  );
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // Refresh tree view
  context.subscriptions.push(
    vscode.commands.registerCommand('sfccContentUpdater.refresh', async () => {
      contentTreeProvider.refresh();
      vscode.window.showInformationMessage('Content assets refreshed');
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
