import * as vscode from 'vscode';
import { ContentAssetMetadata } from '../models/config.model';
import { ContentAssetService } from '../services/content.service';

/**
 * Tree Item for Content Asset
 */
export class ContentAssetTreeItem extends vscode.TreeItem {
  constructor(
    public readonly asset: ContentAssetMetadata,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    // Use the localized name or fall back to ID
    const displayName = asset.name?.default || asset.id;
    super(displayName, collapsibleState);

    // Set tooltip with description or ID
    const description = asset.description?.default || '';
    this.tooltip = description
      ? `${asset.id}\n\n${description}`
      : asset.id;

    // Show ID as description next to the name
    this.description = asset.id;

    // Context value for menu items
    this.contextValue = 'contentAsset';

    // Set icon based on online status
    this.iconPath = new vscode.ThemeIcon(
      asset.online ? 'globe' : 'circle-slash',
      asset.online
        ? new vscode.ThemeColor('charts.green')
        : new vscode.ThemeColor('charts.gray')
    );

    // Make it clickable - open the asset when clicked
    this.command = {
      command: 'sfccContentUpdater.openAsset',
      title: 'Open Content Asset',
      arguments: [this.asset]
    };

    // Add resource URI for proper tracking
    this.resourceUri = vscode.Uri.parse(`sfcc-content:${asset.id}`);
  }
}

/**
 * Tree Data Provider for Content Assets
 */
export class ContentTreeProvider
  implements vscode.TreeDataProvider<ContentAssetTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    ContentAssetTreeItem | undefined | null | void
  > = new vscode.EventEmitter<ContentAssetTreeItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<
    ContentAssetTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private isLoading: boolean = false;

  constructor(private contentService: ContentAssetService) {}

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item representation
   */
  getTreeItem(element: ContentAssetTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children (content assets)
   */
  async getChildren(
    element?: ContentAssetTreeItem
  ): Promise<ContentAssetTreeItem[]> {
    // Content assets don't have children
    if (element) {
      return [];
    }

    // Prevent multiple simultaneous loads
    if (this.isLoading) {
      return [];
    }

    try {
      this.isLoading = true;

      // Fetch content assets from SFCC
      const assets = await this.contentService.listContentAssets();

      // Sort by name (or ID if no name)
      const sortedAssets = assets.sort((a, b) => {
        const nameA = (a.name?.default || a.id).toLowerCase();
        const nameB = (b.name?.default || b.id).toLowerCase();
        return nameA.localeCompare(nameB);
      });

      // Convert to tree items
      return sortedAssets.map(
        (asset) =>
          new ContentAssetTreeItem(
            asset,
            vscode.TreeItemCollapsibleState.None
          )
      );
    } catch (error: any) {
      // Show error to user
      vscode.window.showErrorMessage(
        `Failed to load content assets: ${error.message}`
      );

      // Return empty array
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Get parent (not used, content assets are flat)
   */
  getParent?(
    element: ContentAssetTreeItem
  ): vscode.ProviderResult<ContentAssetTreeItem> {
    return undefined;
  }
}
