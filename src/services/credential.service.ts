import * as vscode from 'vscode';

/**
 * SFCC Credentials stored in SecretStorage
 */
export interface SFCCCredentials {
  username: string;
  password: string;
  clientId: string;
  clientSecret: string;
}

/**
 * Credential Service
 * Manages secure storage of SFCC credentials using VS Code's SecretStorage API
 * Credentials are stored in OS-native secure storage (Keychain/Credential Manager)
 */
export class CredentialService {
  private static instance: CredentialService;
  private secrets: vscode.SecretStorage;

  private static readonly KEYS = {
    USERNAME: 'sfcc.username',
    PASSWORD: 'sfcc.password',
    CLIENT_ID: 'sfcc.clientId',
    CLIENT_SECRET: 'sfcc.clientSecret'
  };

  private constructor(secrets: vscode.SecretStorage) {
    this.secrets = secrets;
  }

  /**
   * Initialize the credential service
   */
  static init(context: vscode.ExtensionContext): void {
    CredentialService.instance = new CredentialService(context.secrets);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CredentialService {
    if (!CredentialService.instance) {
      throw new Error(
        'CredentialService not initialized. Call init() first.'
      );
    }
    return CredentialService.instance;
  }

  /**
   * Get stored credentials
   */
  async getCredentials(): Promise<SFCCCredentials | null> {
    const username = await this.secrets.get(CredentialService.KEYS.USERNAME);
    const password = await this.secrets.get(CredentialService.KEYS.PASSWORD);
    const clientId = await this.secrets.get(CredentialService.KEYS.CLIENT_ID);
    const clientSecret = await this.secrets.get(
      CredentialService.KEYS.CLIENT_SECRET
    );

    if (!username || !password || !clientId || !clientSecret) {
      return null;
    }

    return { username, password, clientId, clientSecret };
  }

  /**
   * Store credentials securely
   */
  async storeCredentials(credentials: SFCCCredentials): Promise<void> {
    await this.secrets.store(
      CredentialService.KEYS.USERNAME,
      credentials.username
    );
    await this.secrets.store(
      CredentialService.KEYS.PASSWORD,
      credentials.password
    );
    await this.secrets.store(
      CredentialService.KEYS.CLIENT_ID,
      credentials.clientId
    );
    await this.secrets.store(
      CredentialService.KEYS.CLIENT_SECRET,
      credentials.clientSecret
    );
  }

  /**
   * Clear all stored credentials
   */
  async clearCredentials(): Promise<void> {
    await this.secrets.delete(CredentialService.KEYS.USERNAME);
    await this.secrets.delete(CredentialService.KEYS.PASSWORD);
    await this.secrets.delete(CredentialService.KEYS.CLIENT_ID);
    await this.secrets.delete(CredentialService.KEYS.CLIENT_SECRET);
  }

  /**
   * Check if credentials are configured
   */
  async hasCredentials(): Promise<boolean> {
    const credentials = await this.getCredentials();
    return credentials !== null;
  }
}
