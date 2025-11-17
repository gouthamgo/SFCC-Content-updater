import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import {
  SFCCConfig,
  ContentAsset,
  ContentAssetMetadata,
  ContentAssetListResponse
} from '../models/config.model';
import { AuthService } from './auth.service';

/**
 * Content Asset Service
 * Handles all OCAPI operations for content assets
 */
export class ContentAssetService {
  private axiosInstance: AxiosInstance;
  private authService: AuthService;
  private config: SFCCConfig;

  constructor(config: SFCCConfig, authService: AuthService) {
    this.config = config;
    this.authService = authService;

    // Create axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: `https://${config.hostname}/s/-/dw/data/${config.version || 'v23_2'}`,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    // Configure retry logic
    axiosRetry(this.axiosInstance, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        // Retry on network errors and 5xx server errors
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status ?? 0) >= 500
        );
      },
      onRetry: (retryCount, error, requestConfig) => {
        console.log(
          `Retrying request (${retryCount}/3): ${requestConfig.url}`
        );
      }
    });

    // Add authentication interceptor
    this.axiosInstance.interceptors.request.use(async (config) => {
      const token = await this.authService.getAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  /**
   * List all content assets (metadata only, lightweight)
   */
  async listContentAssets(): Promise<ContentAssetMetadata[]> {
    const url = `/libraries/${this.config.contentLibrary}/content`;
    const fullUrl = `${this.axiosInstance.defaults.baseURL}${url}`;

    console.log('Fetching content assets from:', fullUrl);
    console.log('Content library:', this.config.contentLibrary);

    try {
      const response = await this.axiosInstance.get<ContentAssetListResponse>(
        url,
        {
          params: {
            count: 200, // Adjust based on needs
            select: '(id,name,description,online,template,last_modified)'
          }
        }
      );

      console.log(`Successfully fetched ${response.data.data?.length || 0} content assets`);
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch content assets:', error);
      this.handleError(error, 'list content assets');
      throw error;
    }
  }

  /**
   * Get a single content asset with full details
   */
  async getContentAsset(assetId: string): Promise<ContentAsset> {
    const url = `/libraries/${this.config.contentLibrary}/content/${assetId}`;

    try {
      const response = await this.axiosInstance.get<ContentAsset>(url, {
        params: {
          select: '(**)' // Get all attributes including custom ones
        }
      });

      return response.data;
    } catch (error) {
      this.handleError(error, `get content asset '${assetId}'`);
      throw error;
    }
  }

  /**
   * Create or fully replace a content asset (PUT)
   */
  async putContentAsset(
    assetId: string,
    asset: Partial<ContentAsset>
  ): Promise<ContentAsset> {
    const url = `/libraries/${this.config.contentLibrary}/content/${assetId}`;

    try {
      const response = await this.axiosInstance.put<ContentAsset>(url, asset);
      return response.data;
    } catch (error) {
      this.handleError(error, `create/replace content asset '${assetId}'`);
      throw error;
    }
  }

  /**
   * Partially update a content asset (PATCH) - RECOMMENDED for editing
   */
  async patchContentAsset(
    assetId: string,
    updates: Partial<ContentAsset>
  ): Promise<ContentAsset> {
    const url = `/libraries/${this.config.contentLibrary}/content/${assetId}`;

    try {
      const response = await this.axiosInstance.patch<ContentAsset>(
        url,
        updates
      );
      return response.data;
    } catch (error) {
      this.handleError(error, `update content asset '${assetId}'`);
      throw error;
    }
  }

  /**
   * Delete a content asset
   */
  async deleteContentAsset(assetId: string): Promise<void> {
    const url = `/libraries/${this.config.contentLibrary}/content/${assetId}`;

    try {
      await this.axiosInstance.delete(url);
    } catch (error) {
      this.handleError(error, `delete content asset '${assetId}'`);
      throw error;
    }
  }

  /**
   * Search content assets by query
   */
  async searchContentAssets(query: string): Promise<ContentAssetMetadata[]> {
    const url = `/libraries/${this.config.contentLibrary}/content_search`;

    try {
      const response = await this.axiosInstance.post<ContentAssetListResponse>(
        url,
        {
          query: {
            text_query: {
              fields: ['id', 'name'],
              search_phrase: query
            }
          },
          select: '(id,name,description,online,template,last_modified)',
          count: 50
        }
      );

      return response.data.data || [];
    } catch (error) {
      this.handleError(error, `search content assets for '${query}'`);
      throw error;
    }
  }

  /**
   * Handle OCAPI errors with user-friendly messages
   */
  private handleError(error: any, operation: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.code === 'ENOTFOUND') {
        throw new Error(
          `Cannot reach SFCC instance. Please check your connection.`
        );
      }

      if (axiosError.code === 'ETIMEDOUT') {
        throw new Error(`Request timed out while trying to ${operation}`);
      }

      if (axiosError.response?.status === 401) {
        // Clear token to force re-authentication
        this.authService.clearToken();
        throw new Error(
          `Authentication failed. Please check your credentials and try again.`
        );
      }

      if (axiosError.response?.status === 403) {
        throw new Error(
          `Permission denied for: ${operation}.\n\n` +
            'OCAPI permissions required:\n' +
            '1. Business Manager → Administration → Site Development → Open Commerce API Settings\n' +
            '2. Select Type: Data API\n' +
            '3. Add this to your configuration:\n' +
            '   {\n' +
            '     "client_id": "your-client-id",\n' +
            '     "resources": [\n' +
            '       {\n' +
            '         "resource_id": "/libraries/*/content/**",\n' +
            '         "methods": ["get", "patch", "put"],\n' +
            '         "read_attributes": "(**)",\n' +
            '         "write_attributes": "(**)"\n' +
            '       }\n' +
            '     ]\n' +
            '   }\n' +
            '4. Wait 3 minutes for changes to take effect'
        );
      }

      if (axiosError.response?.status === 404) {
        throw new Error(
          `Resource not found. The content asset or library may not exist.`
        );
      }

      if (axiosError.response?.status === 409) {
        throw new Error(
          `Conflict: The content asset is locked or being edited by another user.`
        );
      }

      if (axiosError.response?.status && axiosError.response.status >= 500) {
        throw new Error(
          `SFCC server error (${axiosError.response.status}). ` +
          'The instance may be experiencing issues. Please try again later.'
        );
      }

      // Include response data if available
      const errorData = axiosError.response?.data as any;
      if (errorData?.fault?.message) {
        throw new Error(
          `Failed to ${operation}: ${errorData.fault.message}`
        );
      }
    }

    // Generic error
    throw new Error(
      `Failed to ${operation}: ${error.message || 'Unknown error'}`
    );
  }

  /**
   * Test OCAPI connection and permissions
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.listContentAssets();
      return true;
    } catch (error) {
      console.error('Content service test connection failed:', error);
      throw error; // Re-throw to preserve error details
    }
  }

  /**
   * Get content library information
   */
  async getLibraryInfo(): Promise<any> {
    const url = `/libraries/${this.config.contentLibrary}`;

    try {
      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      this.handleError(error, 'get library information');
      throw error;
    }
  }
}
