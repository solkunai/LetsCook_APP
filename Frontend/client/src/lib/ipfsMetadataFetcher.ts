/**
 * IPFS Metadata Fetcher
 * 
 * Fetches and parses IPFS metadata JSON from ipfs:// URIs
 * Extracts token image, name, and other metadata for display
 */

export interface IPFSMetadata {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: any[];
  properties?: {
    files?: Array<{
      uri: string;
      type: string;
    }>;
    category?: string;
  };
}

/**
 * IPFS Gateway URLs - prioritized by reliability and speed
 */
const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
  'https://ipfs.fleek.co/ipfs/',
];

/**
 * Metadata cache to avoid redundant network calls
 */
const metadataCache = new Map<string, IPFSMetadata>();

/**
 * Extract CID and path from various IPFS URI formats
 * Returns the full path (CID + optional suffix like /metadata.json)
 */
function extractIPFSPath(uri: string): string | null {
  if (!uri) return null;
  
  // ipfs:// protocol: ipfs://bafkreihan2x62yngsrcslqnkoes7tqe76vhvwdxtoqf2fnbw4kp4jetl74
  // or: ipfs://bafy.../metadata.json
  if (uri.startsWith('ipfs://')) {
    return uri.replace('ipfs://', '').trim();
  }
  
  // Already a full URL: https://gateway.pinata.cloud/ipfs/bafkreihan2x62yngsrcslqnkoes7tqe76vhvwdxtoqf2fnbw4kp4jetl74
  // or: https://gateway.pinata.cloud/ipfs/bafy.../metadata.json
  // Use [^/?#]+ to capture CID with hyphens/underscores and any path suffix
  const urlMatch = uri.match(/\/ipfs\/([^/?#]+(?:\/[^?#]*)?)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  
  // Just a CID (starts with Qm for v0 or baf for v1): bafkreihan2x62yngsrcslqnkoes7tqe76vhvwdxtoqf2fnbw4kp4jetl74
  // Also handle CID with path: bafy.../metadata.json
  if (uri.match(/^[Qmbaf][a-zA-Z0-9_-]+(\/.*)?$/)) {
    return uri;
  }
  
  return null;
}

/**
 * Convert ipfs:// URI to fetchable HTTP URL
 * Uses primary gateway (Pinata) by default
 * Preserves path suffixes like /metadata.json
 */
export function convertIPFSUriToUrl(uri: string | null | undefined): string | null {
  if (!uri) return null;
  
  // Already a full HTTP URL
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }
  
  // Extract IPFS path (CID + optional suffix) from various formats
  const path = extractIPFSPath(uri);
  if (!path) {
    // If we can't extract a path, return the original (might be a regular URL)
    return uri;
  }
  
  // Use primary gateway (Pinata) for conversion
  // Preserves any suffix like /metadata.json
  return `${IPFS_GATEWAYS[0]}${path}`;
}

/**
 * Fetch metadata JSON from IPFS URI
 * Tries multiple gateways for reliability
 * Uses caching to avoid redundant network calls
 */
export async function fetchIPFSMetadata(uri: string | null | undefined): Promise<IPFSMetadata | null> {
  if (!uri) return null;
  
  // Check cache first
  if (metadataCache.has(uri)) {
    console.log('📦 Using cached metadata for:', uri);
    return metadataCache.get(uri)!;
  }
  
  try {
    // Extract IPFS path (CID + optional suffix) from URI
    const path = extractIPFSPath(uri);
    if (!path) {
      console.warn('⚠️ Could not extract IPFS path from URI:', uri);
      return null;
    }
    
    console.log('🔍 Fetching IPFS metadata for path:', path);
    
    // Try all gateways in order until one succeeds
    for (const gateway of IPFS_GATEWAYS) {
      const gatewayUrl = `${gateway}${path}`;
      
      try {
        console.log(`  Trying gateway: ${gateway}`);
        
        const response = await fetch(gatewayUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          },
          redirect: 'follow', // Follow redirects (some gateways redirect)
          signal: AbortSignal.timeout(8000) // 8 second timeout per gateway
        });
        
        if (response.ok) {
          // Parse JSON with error handling for malformed JSON
          try {
            const text = await response.text();
            const metadata = JSON.parse(text) as IPFSMetadata;
            
            // Cache the successful result
            metadataCache.set(uri, metadata);
            
            console.log(`✅ Successfully fetched from ${gateway}:`, metadata);
            return metadata;
          } catch (parseError: any) {
            console.warn(`  ⚠️ Invalid JSON from ${gateway}:`, parseError?.message || 'Unknown parse error');
            // Try next gateway - this one returned invalid JSON
            continue;
          }
        } else {
          console.log(`  ⚠️ Gateway ${gateway} returned status ${response.status}`);
        }
      } catch (error: any) {
        // Network errors, timeouts, etc.
        const errorMsg = error?.message || 'Unknown error';
        console.log(`  ⚠️ Gateway ${gateway} failed: ${errorMsg}`);
        continue; // Try next gateway
      }
    }
    
    console.warn('❌ All IPFS gateways failed for path:', path);
    console.warn('   Original URI:', uri);
    return null;
  } catch (error) {
    console.error('❌ Error fetching IPFS metadata:', error);
    return null;
  }
}

/**
 * Clear the metadata cache (useful for testing or forced refresh)
 */
export function clearMetadataCache(): void {
  metadataCache.clear();
  console.log('🗑️ Metadata cache cleared');
}

/**
 * Get cache size (for debugging)
 */
export function getCacheSize(): number {
  return metadataCache.size;
}

/**
 * Get token image URL from metadata URI
 * Fetches the metadata JSON and extracts the image field
 */
export async function getTokenImageFromMetadata(metadataUri: string | null | undefined): Promise<string | null> {
  if (!metadataUri) return null;
  
  try {
    const metadata = await fetchIPFSMetadata(metadataUri);
    if (!metadata) return null;
    
    // Extract image URL
    if (metadata.image) {
      // Convert image URL if it's also an IPFS URI
      return convertIPFSUriToUrl(metadata.image);
    }
    
    // Check properties.files for image
    if (metadata.properties?.files && metadata.properties.files.length > 0) {
      const imageFile = metadata.properties.files.find(f => 
        f.type?.startsWith('image/') || f.uri
      );
      if (imageFile?.uri) {
        return convertIPFSUriToUrl(imageFile.uri);
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting token image from metadata:', error);
    return null;
  }
}

/**
 * Get token name from metadata URI
 */
export async function getTokenNameFromMetadata(metadataUri: string | null | undefined): Promise<string | null> {
  if (!metadataUri) return null;
  
  try {
    const metadata = await fetchIPFSMetadata(metadataUri);
    return metadata?.name || null;
  } catch (error) {
    console.error('❌ Error getting token name from metadata:', error);
    return null;
  }
}

/**
 * Get full token metadata (name, symbol, image, description) from metadata URI
 */
export async function getFullTokenMetadata(metadataUri: string | null | undefined): Promise<{
  name?: string;
  symbol?: string;
  image?: string;
  description?: string;
} | null> {
  if (!metadataUri) return null;
  
  try {
    // Normalize the URI - handle both ipfs:// and direct URLs
    let normalizedUri = metadataUri;
    
    // If it's just a CID (starts with Qm or baf), add ipfs:// prefix
    if (metadataUri.match(/^[Qmbaf][a-zA-Z0-9]+$/)) {
      normalizedUri = `ipfs://${metadataUri}`;
      console.log('📝 Normalized CID to IPFS URI:', normalizedUri);
    }
    
    const metadata = await fetchIPFSMetadata(normalizedUri);
    if (!metadata) {
      console.warn('⚠️ Could not fetch metadata from URI:', normalizedUri);
      return null;
    }
    
    console.log('✅ Fetched metadata successfully:', {
      name: metadata.name,
      symbol: metadata.symbol,
      hasImage: !!metadata.image,
      hasDescription: !!metadata.description
    });
    
    // Extract and convert image URL if present
    let imageUrl: string | undefined;
    if (metadata.image) {
      // If image is a relative path or CID, convert it
      if (metadata.image.startsWith('ipfs://') || metadata.image.match(/^[Qmbaf][a-zA-Z0-9]+$/)) {
        imageUrl = convertIPFSUriToUrl(metadata.image) || undefined;
      } else if (metadata.image.startsWith('http://') || metadata.image.startsWith('https://')) {
        imageUrl = metadata.image;
      } else {
        // Try prepending the metadata URI's gateway
        const path = extractIPFSPath(normalizedUri);
        if (path) {
          // Extract base gateway from metadata URI
          const baseUrl = normalizedUri.includes('/ipfs/') 
            ? normalizedUri.substring(0, normalizedUri.indexOf('/ipfs/') + 6)
            : 'https://gateway.pinata.cloud/ipfs/';
          imageUrl = `${baseUrl}${metadata.image}`;
        }
      }
    }
    
    return {
      name: metadata.name,
      symbol: metadata.symbol,
      image: imageUrl,
      description: metadata.description
    };
  } catch (error) {
    console.error('❌ Error getting full token metadata:', error);
    return null;
  }
}

