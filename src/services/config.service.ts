import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SFCCConfig } from '../models/config.model';

/**
 * Configuration Service
 * Handles reading and validating dw.json configuration file
 */
export class ConfigService {
  private static instance: ConfigService;
  private config: SFCCConfig | null = null;
  private configPath: string | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Load configuration from dw.json
   */
  async loadConfig(): Promise<SFCCConfig> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error(
        'No workspace folder open. Please open a folder containing dw.json'
      );
    }

    // Look for dw.json in workspace root
    this.configPath = path.join(workspaceFolders[0].uri.fsPath, 'dw.json');

    if (!fs.existsSync(this.configPath)) {
      const createConfig = await vscode.window.showErrorMessage(
        'dw.json not found in workspace root. Would you like to create a template?',
        'Create Template',
        'Cancel'
      );

      if (createConfig === 'Create Template') {
        await this.createTemplateConfig(this.configPath);
        throw new Error(
          'Please fill in your SFCC credentials in dw.json and reload the extension'
        );
      } else {
        throw new Error('dw.json configuration file not found');
      }
    }

    try {
      const configContent = fs.readFileSync(this.configPath, 'utf-8');
      this.config = JSON.parse(configContent);

      // Validate configuration
      this.validateConfig(this.config!);

      return this.config!;
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in dw.json: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate required configuration fields
   */
  private validateConfig(config: SFCCConfig): void {
    const requiredFields: (keyof SFCCConfig)[] = [
      'hostname',
      'username',
      'password',
      'clientId',
      'clientSecret',
      'contentLibrary'
    ];

    const missing = requiredFields.filter(field => !config[field]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required fields in dw.json: ${missing.join(', ')}. ` +
        `Please check the documentation for required configuration.`
      );
    }

    // Validate hostname format
    if (config.hostname.includes('://')) {
      throw new Error(
        'hostname should not include protocol (http:// or https://). ' +
        'Example: dev01-realm-customer.demandware.net'
      );
    }

    // Set default OCAPI version if not specified
    if (!config.version) {
      config.version = 'v23_2';
    }
  }

  /**
   * Create a template dw.json file
   */
  private async createTemplateConfig(configPath: string): Promise<void> {
    const template: SFCCConfig = {
      hostname: 'dev01-realm-customer.demandware.net',
      username: 'your-business-manager-username',
      password: 'your-access-key',
      clientId: 'your-ocapi-client-id',
      clientSecret: 'your-ocapi-client-secret',
      contentLibrary: 'SiteGenesis',
      version: 'v23_2'
    };

    fs.writeFileSync(
      configPath,
      JSON.stringify(template, null, 2),
      'utf-8'
    );

    // Open the file for editing
    const doc = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(doc);
  }

  /**
   * Get current configuration
   */
  getConfig(): SFCCConfig {
    if (!this.config) {
      throw new Error(
        'Configuration not loaded. Please reload the extension or check dw.json'
      );
    }
    return this.config;
  }

  /**
   * Reload configuration from disk
   */
  async reloadConfig(): Promise<SFCCConfig> {
    this.config = null;
    return this.loadConfig();
  }

  /**
   * Check if configuration is loaded
   */
  isConfigLoaded(): boolean {
    return this.config !== null;
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string | null {
    return this.configPath;
  }
}
