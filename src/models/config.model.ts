/**
 * SFCC Configuration Interface
 * Represents the structure of dw.json file
 */
export interface SFCCConfig {
  hostname: string;
  username: string;
  password: string; // Access key for Business Manager
  clientId: string; // OCAPI Client ID
  clientSecret: string; // OCAPI Client Secret
  codeVersion?: string; // Optional code version
  contentLibrary: string; // Content library ID
  version?: string; // OCAPI version (default: v23_2)
}

/**
 * Content Asset Interface
 * Represents a content asset from SFCC
 */
export interface ContentAsset {
  id: string;
  name?: LocalizedString;
  description?: LocalizedString;
  online: boolean;
  searchable: boolean;
  template?: string;
  page_title?: LocalizedString;
  page_description?: LocalizedString;
  page_keywords?: LocalizedString;
  page_url?: LocalizedString;
  c_body?: string; // Custom attribute for HTML content
  last_modified?: string;
  creation_date?: string;
  link?: string;
  [key: string]: any; // Allow additional custom attributes
}

/**
 * Localized String Interface
 * SFCC uses this format for multi-language support
 */
export interface LocalizedString {
  default?: string;
  [locale: string]: string | undefined;
}

/**
 * Content Asset List Response
 * Response from OCAPI list endpoint
 */
export interface ContentAssetListResponse {
  count: number;
  total: number;
  data: ContentAsset[];
  next?: string;
  previous?: string;
  start: number;
}

/**
 * OAuth Token Response
 * Response from OCAPI OAuth endpoint
 */
export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

/**
 * Metadata for content assets (lightweight)
 * Used for tree view to avoid loading full content
 */
export interface ContentAssetMetadata {
  id: string;
  name?: LocalizedString;
  description?: LocalizedString;
  online: boolean;
  template?: string;
  last_modified?: string;
}
