// Pinata IPFS Service - Using REST API directly (browser-compatible)
// Pinata configuration
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || '';
const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY || '';
const PINATA_SECRET_KEY = import.meta.env.VITE_PINATA_SECRET_KEY || '';

export interface PinataUploadResult {
  id?: string;
  name?: string;
  cid: string;
  size: number;
  number_of_files?: number;
  mime_type?: string;
  group_id?: string | null;
}

export interface PinataMetadata {
  name?: string;
  keyvalues?: Record<string, string>;
}

export class PinataService {
  private static instance: PinataService;
  private isConfigured: boolean;
  private useJWT: boolean;

  private constructor() {
    // Support both JWT and API Key/Secret authentication
    this.useJWT = !!PINATA_JWT;
    this.isConfigured = !!(PINATA_JWT || (PINATA_API_KEY && PINATA_SECRET_KEY));
    
    if (!this.isConfigured) {
      console.warn('⚠️ Pinata credentials not configured. Image uploads will fail.');
      console.warn('   Set VITE_PINATA_JWT or VITE_PINATA_API_KEY + VITE_PINATA_SECRET_KEY');
    }
  }

  public static getInstance(): PinataService {
    if (!PinataService.instance) {
      PinataService.instance = new PinataService();
    }
    return PinataService.instance;
  }

  /**
   * Get authorization headers for Pinata API
   */
  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {};
    
    if (this.useJWT && PINATA_JWT) {
      headers['Authorization'] = `Bearer ${PINATA_JWT}`;
    } else if (PINATA_API_KEY && PINATA_SECRET_KEY) {
      headers['pinata_api_key'] = PINATA_API_KEY;
      headers['pinata_secret_api_key'] = PINATA_SECRET_KEY;
    }
    
    return headers;
  }

  /**
   * Upload image file to IPFS via Pinata REST API (browser-compatible)
   */
  public async uploadImage(
    file: File, 
    metadata?: PinataMetadata
  ): Promise<PinataUploadResult> {
    if (!this.isConfigured) {
      throw new Error('Pinata credentials not configured. Please set VITE_PINATA_JWT or VITE_PINATA_API_KEY + VITE_PINATA_SECRET_KEY');
    }

    try {
      // Use FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      
      // Add metadata if provided
      if (metadata?.name || metadata?.keyvalues) {
        const pinataMetadata: any = {};
        if (metadata.name) {
          pinataMetadata.name = metadata.name;
        }
        if (metadata.keyvalues) {
          pinataMetadata.keyvalues = metadata.keyvalues;
        }
        formData.append('pinataMetadata', JSON.stringify(pinataMetadata));
      }

      // Use Pinata REST API endpoint (browser-compatible)
      // Note: Don't set Content-Type header - browser will set it automatically with boundary for FormData
      const authHeaders = this.getAuthHeaders();
      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: authHeaders, // Only auth headers, browser sets Content-Type for FormData
        body: formData,
        mode: 'cors', // Explicitly set CORS mode
        credentials: 'omit', // Don't send credentials (cookies) with CORS requests
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Pinata API error:', errorText);
        throw new Error(`Pinata API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      // Validate response has IpfsHash
      if (!result.IpfsHash) {
        console.error('❌ Pinata API response missing IpfsHash:', result);
        throw new Error('Invalid response from Pinata API: missing IpfsHash');
      }
      
      // Map Pinata API response to our interface
      const uploadResult: PinataUploadResult = {
        cid: result.IpfsHash,
        size: result.PinSize || file.size,
        name: metadata?.name || file.name,
        mime_type: file.type,
      };
      
      // Log the full URL for debugging
      const pinataUrl = this.getPinataUrl(uploadResult.cid);
      console.log('✅ Image uploaded to IPFS:', {
        cid: uploadResult.cid,
        pinataUrl: pinataUrl,
        size: uploadResult.size,
        name: uploadResult.name
      });
      
      return uploadResult;

    } catch (error) {
      console.error('❌ Failed to upload image to IPFS:', error);
      throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload base64 image to IPFS via Pinata REST API
   * Uses proxy endpoint if available to bypass CORS
   */
  public async uploadBase64Image(
    base64Data: string,
    filename: string = 'token-image.png',
    metadata?: PinataMetadata
  ): Promise<PinataUploadResult> {
    if (!this.isConfigured) {
      throw new Error('Pinata credentials not configured.');
    }

    try {
      // Try using proxy endpoint first (bypasses CORS)
      try {
        const proxyUrl = '/api/pinata/upload';
        const contentType = base64Data.startsWith('data:') 
          ? base64Data.split(';')[0].split(':')[1] 
          : 'image/png';

        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileData: base64Data,
            filename: filename,
            contentType: contentType,
            metadata: metadata,
          }),
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            console.log('✅ Image uploaded via proxy:', result);
            return {
              cid: result.cid,
              size: result.size,
              name: result.name || filename,
              mime_type: contentType,
            };
          } else {
            // Response is not JSON (likely HTML error page)
            const text = await response.text();
            console.warn('⚠️ Proxy returned non-JSON response, falling back to direct API:', text.substring(0, 100));
          }
        } else {
          const errorText = await response.text();
          console.warn('⚠️ Proxy upload failed, falling back to direct API:', errorText.substring(0, 100));
        }
      } catch (proxyError: any) {
        // Check if it's a JSON parse error (HTML response)
        if (proxyError instanceof SyntaxError && proxyError.message.includes('JSON')) {
          console.warn('⚠️ Proxy returned HTML instead of JSON (route may not exist), falling back to direct API');
        } else {
          console.warn('⚠️ Proxy upload error, falling back to direct API:', proxyError?.message || proxyError);
        }
      }

      // Fallback to direct API (may fail due to CORS in browser)
      // Convert base64 to blob
      const response = await fetch(base64Data);
      const blob = await response.blob();
      
      // Create file from blob
      const file = new File([blob], filename, { type: blob.type || 'image/png' });

      // Upload using the file upload method
      return await this.uploadImage(file, metadata);

    } catch (error) {
      console.error('❌ Failed to upload base64 image to IPFS:', error);
      throw new Error(`Failed to upload base64 image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload JSON data to IPFS via Pinata REST API
   */
  public async uploadJSON(
    jsonData: any,
    filename: string = 'data.json',
    metadata?: PinataMetadata
  ): Promise<PinataUploadResult> {
    if (!this.isConfigured) {
      throw new Error('Pinata credentials not configured.');
    }

    try {
      // Try using proxy endpoint first (bypasses CORS)
      try {
        const proxyUrl = '/api/pinata/upload-json';
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonData: jsonData,
            filename: filename,
            metadata: metadata,
          }),
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            console.log('✅ JSON uploaded via proxy:', result);
            return {
              cid: result.cid,
              size: result.size,
              name: filename,
              mime_type: 'application/json',
            };
          } else {
            const text = await response.text();
            console.warn('⚠️ Proxy returned non-JSON response, falling back to direct API:', text.substring(0, 100));
          }
        } else {
          const errorText = await response.text();
          console.warn('⚠️ Proxy upload failed, falling back to direct API:', errorText.substring(0, 100));
        }
      } catch (proxyError: any) {
        if (proxyError instanceof SyntaxError && proxyError.message.includes('JSON')) {
          console.warn('⚠️ Proxy returned HTML instead of JSON (route may not exist), falling back to direct API');
        } else {
          console.warn('⚠️ Proxy upload error, falling back to direct API:', proxyError?.message || proxyError);
        }
      }

      // Fallback to direct API
      // Convert JSON to Blob
      const jsonBlob = new Blob([JSON.stringify(jsonData)], { type: 'application/json' });
      const file = new File([jsonBlob], filename, { type: 'application/json' });

      // Upload using the file upload method
      return await this.uploadImage(file, metadata);

    } catch (error) {
      console.error('❌ Failed to upload JSON to IPFS:', error);
      throw new Error(`Failed to upload JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get IPFS URL from CID
   */
  public getIPFSUrl(cid: string): string {
    return `https://ipfs.io/ipfs/${cid}`;
  }

  /**
   * Get Pinata gateway URL (faster loading)
   */
  public getPinataUrl(cid: string): string {
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }

  /**
   * Check if Pinata is configured
   */
  public isPinataConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Test Pinata connection
   */
  public async testConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      // Test with a simple file upload
      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const result = await this.uploadImage(testFile, { name: 'test-connection' });
      console.log('✅ Pinata connection test successful:', result);
      return true;
    } catch (error) {
      console.error('❌ Pinata connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const pinataService = PinataService.getInstance();

// Helper function to convert base64 to IPFS URL
// Uses Pinata gateway for faster, more reliable access
export const uploadImageToIPFS = async (
  base64Data: string,
  filename?: string,
  metadata?: PinataMetadata
): Promise<string> => {
  const result = await pinataService.uploadBase64Image(base64Data, filename, metadata);
  // Use Pinata gateway for faster access (more reliable than ipfs.io)
  return pinataService.getPinataUrl(result.cid);
};

// Helper function to upload file to IPFS
// Uses Pinata gateway for faster, more reliable access
export const uploadFileToIPFS = async (
  file: File,
  metadata?: PinataMetadata
): Promise<string> => {
  const result = await pinataService.uploadImage(file, metadata);
  // Use Pinata gateway for faster access (more reliable than ipfs.io)
  return pinataService.getPinataUrl(result.cid);
};

// Helper function to upload JSON to IPFS
export const uploadJSONToIPFS = async (
  jsonData: any,
  filename?: string,
  metadata?: PinataMetadata
): Promise<string> => {
  const result = await pinataService.uploadJSON(jsonData, filename, metadata);
  return pinataService.getIPFSUrl(result.cid);
};