import * as vscode from 'vscode';
import { ContentAssetMetadata } from '../models/config.model';

/**
 * Error Tree Item (shown when no config or connection issues)
 */
export class ErrorTreeItem extends vscode.TreeItem {
  constructor(message: string, isConfigureButton: boolean = false) {
    super(message, vscode.TreeItemCollapsibleState.None);

    if (isConfigureButton) {
      // Configuration button styling
      this.iconPath = new vscode.ThemeIcon(
        'gear',
        new vscode.ThemeColor('editorInfo.foreground')
      );
      this.tooltip = 'Click to configure SFCC connection';

      // Make it clickable - opens configuration command
      this.command = {
        command: 'sfccContentUpdater.configure',
        title: 'Configure Connection'
      };
    } else {
      this.iconPath = new vscode.ThemeIcon(
        'warning',
        new vscode.ThemeColor('editorWarning.foreground')
      );
      this.tooltip = message;
    }

    this.contextValue = 'error';
  }
}

/**
 * Empty Tree Provider (shows when extension isn't configured)
 */
export class EmptyTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(
    private errorMessage: string,
    private isConfigureButton: boolean = false
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  updateError(newMessage: string, isConfigureButton: boolean = false): void {
    this.errorMessage = newMessage;
    this.isConfigureButton = isConfigureButton;
    this.refresh();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) {
      return [];
    }
    return [new ErrorTreeItem(this.errorMessage, this.isConfigureButton)];
  }
}
