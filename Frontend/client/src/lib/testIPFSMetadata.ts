/**
 * Test utility for verifying IPFS metadata URLs are reachable
 * 
 * Usage in browser console:
 * import { testIPFSMetadata } from '@/lib/testIPFSMetadata';
 * testIPFSMetadata('ipfs://bafkreihan2x62yngsrcslqnkoes7tqe76vhvwdxtoqf2fnbw4kp4jetl74');
 */

import { fetchIPFSMetadata, convertIPFSUriToUrl, getTokenImageFromMetadata } from './ipfsMetadataFetcher';

/**
 * Test if an IPFS URI is reachable and fetch its metadata
 */
export async function testIPFSMetadata(uri: string): Promise<{
  reachable: boolean;
  cid?: string;
  metadata?: any;
  imageUrl?: string;
  error?: string;
}> {
  console.log('🧪 Testing IPFS metadata URI:', uri);
  
  try {
    // Test URL conversion
    const httpUrl = convertIPFSUriToUrl(uri);
    console.log('📝 Converted to HTTP URL:', httpUrl);
    
    // Try to fetch metadata
    const metadata = await fetchIPFSMetadata(uri);
    
    if (metadata) {
      console.log('✅ Metadata fetched successfully:', metadata);
      
      // Try to get image URL
      let imageUrl: string | null = null;
      if (metadata.image) {
        imageUrl = convertIPFSUriToUrl(metadata.image);
        console.log('🖼️ Image URL:', imageUrl);
      }
      
      return {
        reachable: true,
        metadata,
        imageUrl: imageUrl || undefined
      };
    } else {
      return {
        reachable: false,
        error: 'Failed to fetch metadata from all gateways'
      };
    }
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    return {
      reachable: false,
      error: error?.message || 'Unknown error'
    };
  }
}

/**
 * Test multiple IPFS URIs at once
 */
export async function testMultipleIPFSMetadata(uris: string[]): Promise<Array<{
  uri: string;
  reachable: boolean;
  metadata?: any;
}>> {
  const results = [];
  
  for (const uri of uris) {
    const result = await testIPFSMetadata(uri);
    results.push({
      uri,
      reachable: result.reachable,
      metadata: result.metadata
    });
  }
  
  return results;
}



