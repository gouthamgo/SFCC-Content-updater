import * as vscode from 'vscode';
import { SFCCConfig } from '../models/config.model';
import { CredentialService } from './credential.service';

/**
 * Configuration Service
 * Handles reading SFCC configuration from workspace settings and SecretStorage
 */
export class ConfigService {
  private static instance: ConfigService;
  private config: SFCCConfig | null = null;

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
   * Load configuration from workspace settings and SecretStorage
   */
  async loadConfig(): Promise<SFCCConfig> {
    // Get workspace settings (non-sensitive)
    const workspaceConfig = vscode.workspace.getConfiguration(
      'sfccContentUpdater'
    );
    const hostname = workspaceConfig.get<string>('hostname');
    const contentLibrary =
      workspaceConfig.get<string>('contentLibrary') || 'shared_library';

    // Get credentials from SecretStorage (sensitive)
    const credentialService = CredentialService.getInstance();
    const credentials = await credentialService.getCredentials();

    // Validate configuration
    const missing: string[] = [];

    if (!hostname) {
      missing.push('hostname (workspace setting)');
    }
    if (!credentials) {
      missing.push('credentials (use "SFCC: Configure Connection")');
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing SFCC configuration: ${missing.join(', ')}. ` +
          'Run "SFCC: Configure Connection" command to set up.'
      );
    }

    // Validate hostname format
    if (hostname && hostname.includes('://')) {
      throw new Error(
        'hostname should not include protocol (http:// or https://). ' +
          'Example: dev01-realm-customer.demandware.net'
      );
    }

    // Build complete configuration
    this.config = {
      hostname: hostname!,
      contentLibrary,
      username: credentials!.username,
      password: credentials!.password,
      clientId: credentials!.clientId,
      clientSecret: credentials!.clientSecret,
      version: 'v23_2'
    };

    return this.config;
  }

  /**
   * Get current configuration
   */
  getConfig(): SFCCConfig {
    if (!this.config) {
      throw new Error(
        'Configuration not loaded. Run "SFCC: Configure Connection" command.'
      );
    }
    return this.config;
  }

  /**
   * Reload configuration
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
}
