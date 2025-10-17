// Pinata IPFS Service - Using Current Pinata SDK
import { PinataSDK } from "pinata";

// Pinata configuration
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || '';

export interface PinataUploadResult {
  id: string;
  name: string;
  cid: string;
  size: number;
  number_of_files: number;
  mime_type: string;
  group_id: string | null;
}

export interface PinataMetadata {
  name?: string;
  keyvalues?: Record<string, string>;
}

export class PinataService {
  private static instance: PinataService;
  private pinata: PinataSDK | null = null;
  private isConfigured: boolean;

  private constructor() {
    this.isConfigured = PINATA_JWT ? true : false;
    
    if (this.isConfigured) {
      this.pinata = new PinataSDK({
        pinataJwt: PINATA_JWT,
        pinataGateway: "gateway.pinata.cloud", // Default gateway
      });
    } else {
      console.warn('⚠️ Pinata JWT not configured. Image uploads will use base64 fallback.');
    }
  }

  public static getInstance(): PinataService {
    if (!PinataService.instance) {
      PinataService.instance = new PinataService();
    }
    return PinataService.instance;
  }

  /**
   * Upload image file to IPFS via Pinata SDK
   */
  public async uploadImage(
    file: File, 
    metadata?: PinataMetadata
  ): Promise<PinataUploadResult> {
    if (!this.isConfigured || !this.pinata) {
      throw new Error('Pinata JWT not configured. Please set VITE_PINATA_JWT environment variable.');
    }

    try {
      // Upload using the new SDK structure
      let upload = this.pinata.upload.public.file(file);
      
      // Add metadata if provided
      if (metadata?.name) {
        upload = upload.name(metadata.name);
      }
      
      if (metadata?.keyvalues) {
        upload = upload.keyvalues(metadata.keyvalues);
      }

      const result = await upload;
      
      console.log('✅ Image uploaded to IPFS:', result);
      return result;

    } catch (error) {
      console.error('❌ Failed to upload image to IPFS:', error);
      throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload base64 image to IPFS via Pinata SDK
   */
  public async uploadBase64Image(
    base64Data: string,
    filename: string = 'token-image.png',
    metadata?: PinataMetadata
  ): Promise<PinataUploadResult> {
    if (!this.isConfigured || !this.pinata) {
      throw new Error('Pinata JWT not configured.');
    }

    try {
      // Convert base64 to blob
      const response = await fetch(base64Data);
      const blob = await response.blob();
      
      // Create file from blob
      const file = new File([blob], filename, { type: blob.type });

      // Upload using the file upload method
      return await this.uploadImage(file, metadata);

    } catch (error) {
      console.error('❌ Failed to upload base64 image to IPFS:', error);
      throw new Error(`Failed to upload base64 image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload JSON data to IPFS
   */
  public async uploadJSON(
    jsonData: any,
    filename: string = 'data.json',
    metadata?: PinataMetadata
  ): Promise<PinataUploadResult> {
    if (!this.isConfigured || !this.pinata) {
      throw new Error('Pinata JWT not configured.');
    }

    try {
      let upload = this.pinata.upload.public.json(jsonData);
      
      if (metadata?.name) {
        upload = upload.name(metadata.name);
      }
      
      if (metadata?.keyvalues) {
        upload = upload.keyvalues(metadata.keyvalues);
      }

      const result = await upload;
      console.log('✅ JSON uploaded to IPFS:', result);
      return result;

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
    if (!this.isConfigured || !this.pinata) {
      return false;
    }

    try {
      // Test with a simple file upload
      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const result = await this.pinata.upload.public.file(testFile);
      console.log('✅ Pinata connection test successful:', result);
      
      // Clean up test file
      if (result.id) {
        await this.deleteFile(result.id);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Pinata connection test failed:', error);
      return false;
    }
  }

  /**
   * List uploaded files
   */
  public async listFiles(options?: {
    pageLimit?: number;
    pageOffset?: number;
    sort?: 'ASC' | 'DESC';
    status?: 'pinned' | 'pinning' | 'failed';
  }) {
    if (!this.isConfigured || !this.pinata) {
      throw new Error('Pinata JWT not configured.');
    }

    try {
      const result = await this.pinata.files.public.list(options);
      return result;
    } catch (error) {
      console.error('❌ Failed to list files:', error);
      throw error;
    }
  }

  /**
   * Delete a file from IPFS
   */
  public async deleteFile(fileId: string): Promise<void> {
    if (!this.isConfigured || !this.pinata) {
      throw new Error('Pinata JWT not configured.');
    }

    try {
      await this.pinata.files.public.delete(fileId);
      console.log('✅ File deleted from IPFS:', fileId);
    } catch (error) {
      console.error('❌ Failed to delete file:', error);
      throw error;
    }
  }

  /**
   * Get file details
   */
  public async getFileDetails(fileId: string) {
    if (!this.isConfigured || !this.pinata) {
      throw new Error('Pinata JWT not configured.');
    }

    try {
      const result = await this.pinata.files.public.get(fileId);
      return result;
    } catch (error) {
      console.error('❌ Failed to get file details:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pinataService = PinataService.getInstance();

// Helper function to convert base64 to IPFS URL
export const uploadImageToIPFS = async (
  base64Data: string,
  filename?: string,
  metadata?: PinataMetadata
): Promise<string> => {
  const result = await pinataService.uploadBase64Image(base64Data, filename, metadata);
  return pinataService.getIPFSUrl(result.cid);
};

// Helper function to upload file to IPFS
export const uploadFileToIPFS = async (
  file: File,
  metadata?: PinataMetadata
): Promise<string> => {
  const result = await pinataService.uploadImage(file, metadata);
  return pinataService.getIPFSUrl(result.cid);
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