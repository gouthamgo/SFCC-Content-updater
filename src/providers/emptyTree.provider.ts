import * as vscode from 'vscode';
import { ContentAssetMetadata } from '../models/config.model';

/**
 * Error Tree Item (shown when no config or connection issues)
 */
export class ErrorTreeItem extends vscode.TreeItem {
  constructor(message: string, isWorkspaceError: boolean = false) {
    super(message, vscode.TreeItemCollapsibleState.None);

    if (isWorkspaceError) {
      // Special styling for workspace errors
      this.iconPath = new vscode.ThemeIcon('folder-opened', new vscode.ThemeColor('editorInfo.foreground'));
      this.tooltip = 'Click "File > Open Folder" to open a workspace with dw.json';
    } else {
      this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
      this.tooltip = message;
    }

    this.contextValue = 'error';
  }
}

/**
 * Empty Tree Provider (shows when extension isn't configured)
 */
export class EmptyTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private errorMessage: string, private isWorkspaceError: boolean = false) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  updateError(newMessage: string, isWorkspaceError: boolean = false): void {
    this.errorMessage = newMessage;
    this.isWorkspaceError = isWorkspaceError;
    this.refresh();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) {
      return [];
    }
    return [new ErrorTreeItem(this.errorMessage, this.isWorkspaceError)];
  }
}
