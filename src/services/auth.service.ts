import axios, { AxiosError } from 'axios';
import { SFCCConfig, OAuthTokenResponse } from '../models/config.model';

/**
 * Authentication Service
 * Handles OAuth authentication with SFCC OCAPI
 */
export class AuthService {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private config: SFCCConfig;

  constructor(config: SFCCConfig) {
    this.config = config;
  }

  /**
   * Get valid access token (requests new one if expired)
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.isTokenValid()) {
      return this.accessToken!;
    }

    // Request new token
    return this.requestNewToken();
  }

  /**
   * Check if current token is still valid
   */
  private isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpiry) {
      return false;
    }

    // Add 60 second buffer before expiry
    const now = new Date();
    const expiryWithBuffer = new Date(this.tokenExpiry.getTime() - 60000);

    return now < expiryWithBuffer;
  }

  /**
   * Request new OAuth access token using Client Credentials Grant
   */
  private async requestNewToken(): Promise<string> {
    // IMPORTANT: Client Credentials Grant uses account.demandware.com
    // NOT the instance hostname!
    const tokenUrl = 'https://account.demandware.com/dw/oauth2/access_token';

    console.log('Requesting OAuth token from:', tokenUrl);
    console.log('Using clientId:', this.config.clientId);

    try {
      // Prepare credentials for Basic Auth
      const credentials = `${this.config.clientId}:${this.config.clientSecret}`;
      const encodedCredentials = Buffer.from(credentials).toString('base64');

      // Prepare request body
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');

      // Make OAuth request
      const response = await axios.post<OAuthTokenResponse>(
        tokenUrl,
        params,
        {
          headers: {
            'Authorization': `Basic ${encodedCredentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      console.log('OAuth token received successfully');

      // Store token and expiry
      this.accessToken = response.data.access_token;

      // Calculate expiry time (subtract 60s for safety margin)
      const expiresInSeconds = response.data.expires_in - 60;
      this.tokenExpiry = new Date(Date.now() + expiresInSeconds * 1000);

      return this.accessToken;
    } catch (error) {
      console.error('OAuth token request failed:', error);
      this.handleAuthError(error);
      throw error; // Re-throw after handling
    }
  }

  /**
   * Handle authentication errors with helpful messages
   */
  private handleAuthError(error: any): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.code === 'ENOTFOUND') {
        throw new Error(
          `Cannot reach SFCC instance at ${this.config.hostname}. ` +
          'Please check your hostname in dw.json'
        );
      }

      if (axiosError.code === 'ETIMEDOUT') {
        throw new Error(
          'Authentication request timed out. Please check your network connection.'
        );
      }

      if (axiosError.response?.status === 401) {
        const errorData = axiosError.response?.data as any;
        if (errorData?.error === 'invalid_client') {
          throw new Error(
            'Invalid client credentials. Check:\n' +
              '1. Client ID and Secret are correct (from Account Manager → API Client)\n' +
              '2. Token Endpoint Auth Method = "client_secret_basic" in Account Manager\n' +
              '3. Client has correct Organizations assigned'
          );
        }
        throw new Error(
          'Authentication failed (401). Verify your OCAPI Client ID and Secret.'
        );
      }

      if (axiosError.response?.status === 403) {
        throw new Error(
          'OCAPI permissions not configured. Required steps:\n' +
            '1. Business Manager → Administration → Site Development → Open Commerce API Settings\n' +
            '2. Select Type: Data API, Context: Global\n' +
            '3. Add your Client ID with proper resource permissions (see README.md)\n' +
            '4. Wait 3 minutes for cache to clear\n' +
            '5. Note: Wildcards (*) work for ALL SFCC organizations'
        );
      }

      if (axiosError.response?.status && axiosError.response.status >= 500) {
        throw new Error(
          `SFCC server error (${axiosError.response.status}). ` +
          'The instance may be down. Please try again later.'
        );
      }
    }

    // Generic error
    throw new Error(
      `Authentication failed: ${error.message || 'Unknown error'}`
    );
  }

  /**
   * Clear stored token (force re-authentication)
   */
  clearToken(): void {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Test connection and authentication
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get token expiry time (for debugging/status)
   */
  getTokenExpiry(): Date | null {
    return this.tokenExpiry;
  }
}
