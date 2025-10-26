import { pinataService } from './pinataService';

// IPFS Gateway URLs with fallbacks - prioritized by reliability
const IPFS_GATEWAYS = [
  // Most reliable gateways first
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
  
  // Secondary reliable gateways
  'https://ipfs.fleek.co/ipfs/',
  'https://gateway.ipfs.io/ipfs/',
  'https://ipfs.infura.io/ipfs/',
];

// Image cache to avoid repeated fetches
const imageCache = new Map<string, string>();

// Local storage cache for images using IndexedDB
class LocalImageCache {
  private dbName = 'IPFSImageCache';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('images')) {
          const store = db.createObjectStore('images', { keyPath: 'hash' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async getImage(hash: string): Promise<string | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      const request = store.get(hash);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result && this.isNotExpired(result.timestamp)) {
          resolve(result.dataUrl);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async setImage(hash: string, dataUrl: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      const request = store.put({
        hash,
        dataUrl,
        timestamp: Date.now(),
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearExpired(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      const index = store.index('timestamp');
      const request = index.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (this.isNotExpired(cursor.value.timestamp)) {
            cursor.continue();
          } else {
            cursor.delete();
            cursor.continue();
          }
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  private isNotExpired(timestamp: number): boolean {
    // Cache for 24 hours
    const CACHE_DURATION = 24 * 60 * 60 * 1000;
    return Date.now() - timestamp < CACHE_DURATION;
  }
}

const localCache = new LocalImageCache();

// Image optimization utilities
class ImageOptimizer {
  /**
   * Compress and optimize image
   */
  static async optimizeImage(
    imageUrl: string, 
    maxWidth: number = 800, 
    maxHeight: number = 600, 
    quality: number = 0.8
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to optimized format
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(optimizedDataUrl);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  }

  /**
   * Convert image to WebP format for better compression
   */
  static async convertToWebP(imageUrl: string, quality: number = 0.8): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Try WebP, fallback to JPEG
        try {
          const webpDataUrl = canvas.toDataURL('image/webp', quality);
          resolve(webpDataUrl);
        } catch (error) {
          const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(jpegDataUrl);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  }

  /**
   * Create thumbnail version of image
   */
  static async createThumbnail(imageUrl: string, size: number = 200): Promise<string> {
    return this.optimizeImage(imageUrl, size, size, 0.7);
  }

  /**
   * Get image dimensions
   */
  static async getImageDimensions(imageUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  }
}

// Metadata interface for storing raffle image information
export interface RaffleImageMetadata {
  raffleId: string;
  iconHash: string;
  bannerHash: string;
  iconUrl?: string;
  bannerUrl?: string;
  uploadedAt: number;
}

// Service for managing IPFS image metadata and fetching
export class IPFSMetadataService {
  
  /**
   * Store raffle image metadata in IPFS
   */
  static async storeRaffleImages(
    raffleId: string, 
    iconHash: string, 
    bannerHash: string
  ): Promise<string> {
    try {
      const metadata: RaffleImageMetadata = {
        raffleId,
        iconHash,
        bannerHash,
        uploadedAt: Date.now(),
      };

      // Upload metadata to IPFS via Pinata
      const result = await pinataService.uploadJSON(metadata, `raffle-${raffleId}-metadata`);
      console.log('✅ Raffle image metadata stored:', result);
      
      return result.cid;
    } catch (error) {
      console.error('❌ Error storing raffle image metadata:', error);
      throw error;
    }
  }

  /**
   * Fetch raffle image metadata from IPFS
   */
  static async getRaffleImages(raffleId: string): Promise<RaffleImageMetadata | null> {
    try {
      console.log('🔍 Looking for metadata for raffle ID:', raffleId);
      
      // First, try to get the metadata from the blockchain integration service
      // which should have the actual metadata URI stored in the launch data
      try {
        const { blockchainIntegrationService } = await import('./blockchainIntegrationService');
        const launchData = await blockchainIntegrationService.getLaunchByAddress(raffleId);
        
        if (launchData && launchData.metadataUri) {
          console.log('🔍 Found metadata URI in launch data:', launchData.metadataUri);
          
          // Try to fetch the metadata from the URI
          const response = await fetch(launchData.metadataUri, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
          
          if (response.ok) {
            const metadata = await response.json();
            console.log('✅ Found metadata from launch URI:', metadata);
            return metadata;
          } else {
            console.log(`❌ Metadata URI failed:`, response.status, response.statusText);
          }
        }
      } catch (error) {
        console.log('⚠️ Could not fetch metadata from launch data:', error);
      }
      
      // Fallback: Try to look up metadata in localStorage or other storage
      // This is a temporary solution until we have proper metadata storage
      const storageKey = `raffle_metadata_${raffleId}`;
      const storedCid = localStorage.getItem(storageKey);
      
      if (storedCid) {
        console.log('🔍 Found stored metadata CID:', storedCid);
        const url = `https://gateway.pinata.cloud/ipfs/${storedCid}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
          const metadata = await response.json();
          console.log('✅ Found metadata from stored CID:', metadata);
          return metadata;
        }
      }
      
      console.log('⚠️ No metadata found for raffle:', raffleId);
      return null;
    } catch (error) {
      console.error('❌ Error fetching raffle image metadata:', error);
      return null;
    }
  }

  /**
   * Get image URL from IPFS hash with fallback gateways
   */
  static getImageUrl(hash: string): string {
    if (!hash || (!hash.startsWith('Qm') && !hash.startsWith('baf'))) {
      return '';
    }

    // Check memory cache first
    if (imageCache.has(hash)) {
      return imageCache.get(hash)!;
    }

    // Use Pinata gateway as primary (most reliable)
    const url = `https://gateway.pinata.cloud/ipfs/${hash}`;
    
    // Cache the URL
    imageCache.set(hash, url);
    
    return url;
  }

  /**
   * Get image URL directly from Pinata
   */
  static async getOptimizedImage(
    hash: string, 
    type: 'icon' | 'banner' = 'icon',
    useCache: boolean = true
  ): Promise<string> {
    if (!hash || (!hash.startsWith('Qm') && !hash.startsWith('baf'))) {
      console.log('⚠️ Invalid hash:', hash);
      return this.getPlaceholderUrl('', type);
    }

    // Return direct Pinata URL - simple and reliable
    const pinataUrl = `https://gateway.pinata.cloud/ipfs/${hash}`;
    console.log('🖼️ Returning Pinata URL:', pinataUrl);
    return pinataUrl;
  }

  /**
   * Get image URL with fallback gateways
   */
  static async getImageUrlWithFallback(hash: string): Promise<string> {
    if (!hash || (!hash.startsWith('Qm') && !hash.startsWith('baf'))) {
      return '';
    }

    // Check cache first
    if (imageCache.has(hash)) {
      return imageCache.get(hash)!;
    }

    // Try each gateway until one works
    for (const gateway of IPFS_GATEWAYS) {
      try {
        const url = `${gateway}${hash}`;
        console.log(`🔍 Testing gateway: ${gateway} with URL: ${url}`);
        const response = await fetch(url, { method: 'HEAD' });
        
        if (response.ok) {
          // Cache the working URL
          imageCache.set(hash, url);
          console.log(`✅ Found working IPFS gateway: ${gateway}`);
          return url;
        } else {
          console.log(`❌ Gateway ${gateway} returned status: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ Gateway failed: ${gateway}`, error);
        continue;
      }
    }

    // If all gateways fail, return the primary Pinata URL anyway
    const fallbackUrl = `https://gateway.pinata.cloud/ipfs/${hash}`;
    imageCache.set(hash, fallbackUrl);
    return fallbackUrl;
  }

  /**
   * Preload image to check if it's accessible
   */
  static async preloadImage(hash: string): Promise<boolean> {
    if (!hash) return false;

    try {
      const url = this.getImageUrl(hash);
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('❌ Error preloading image:', error);
      return false;
    }
  }

  /**
   * Get placeholder image URL with fallback
   */
  static getPlaceholderUrl(text: string, size: 'icon' | 'banner' = 'icon'): string {
    const dimensions = size === 'icon' ? '200x200' : '800x256';
    const color = '4F46E5';
    const bgColor = 'FFFFFF';
    const displayText = text ? text.slice(0, 10) : 'TOKEN';
    
    // Use multiple placeholder services for reliability
    const services = [
      `https://via.placeholder.com/${dimensions}/${color}/${bgColor}?text=${encodeURIComponent(displayText)}`,
      `https://dummyimage.com/${dimensions}/${color}/${bgColor}&text=${encodeURIComponent(displayText)}`,
      `https://picsum.photos/${dimensions.split('x')[0]}/${dimensions.split('x')[1]}?random=${Math.random()}`,
    ];
    
    // Return the first service (via.placeholder.com is most reliable)
    return services[0];
  }

  /**
   * Create a data URL placeholder as ultimate fallback
   */
  static createDataUrlPlaceholder(text: string, size: 'icon' | 'banner' = 'icon'): string {
    const dimensions = size === 'icon' ? 200 : 800;
    const height = size === 'icon' ? 200 : 256;
    
    // Create a simple SVG placeholder
    const svg = `
      <svg width="${dimensions}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#4F46E5"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" dy=".3em">
          ${text ? text.slice(0, 8) : 'TOKEN'}
        </text>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  /**
   * Clear image cache
   */
  static clearCache(): void {
    imageCache.clear();
  }

  /**
   * Preload images for better UX
   */
  static async preloadImages(hashes: string[], type: 'icon' | 'banner' = 'icon'): Promise<void> {
    console.log(`🔄 Preloading ${hashes.length} images...`);
    
    const preloadPromises = hashes.map(async (hash) => {
      try {
        await this.getOptimizedImage(hash, type, true);
        console.log(`✅ Preloaded image: ${hash}`);
      } catch (error) {
        console.warn(`⚠️ Failed to preload image: ${hash}`, error);
      }
    });
    
    await Promise.allSettled(preloadPromises);
    console.log('✅ Image preloading completed');
  }

  /**
   * Preload raffle images from metadata
   */
  static async preloadRaffleImages(raffleId: string): Promise<void> {
    try {
      const metadata = await this.getRaffleImages(raffleId);
      if (metadata) {
        const hashes = [metadata.iconHash, metadata.bannerHash].filter(Boolean);
        await this.preloadImages(hashes);
      }
    } catch (error) {
      console.error('❌ Error preloading raffle images:', error);
    }
  }

  /**
   * Clear expired cache entries
   */
  static async clearExpiredCache(): Promise<void> {
    try {
      await localCache.clearExpired();
      console.log('✅ Cleared expired cache entries');
    } catch (error) {
      console.error('❌ Error clearing expired cache:', error);
    }
  }

  /**
   * Get comprehensive cache stats
   */
  static async getCacheStats(): Promise<{ 
    memoryCache: { size: number; keys: string[] };
    localCache: { count: number };
  }> {
    return {
      memoryCache: {
        size: imageCache.size,
        keys: Array.from(imageCache.keys()),
      },
      localCache: {
        count: await this.getLocalCacheCount(),
      },
    };
  }

  /**
   * Get local cache count
   */
  private static async getLocalCacheCount(): Promise<number> {
    try {
      if (!localCache['db']) await localCache.init();
      
      return new Promise((resolve, reject) => {
        const transaction = localCache['db']!.transaction(['images'], 'readonly');
        const store = transaction.objectStore('images');
        const request = store.count();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('❌ Error getting local cache count:', error);
      return 0;
    }
  }

  /**
   * Clear all caches
   */
  static async clearAllCaches(): Promise<void> {
    imageCache.clear();
    try {
      await localCache.clearExpired();
      console.log('✅ Cleared all caches');
    } catch (error) {
      console.error('❌ Error clearing local cache:', error);
    }
  }

  /**
   * Test method to manually fetch metadata using a known CID
   */
  static async testMetadataFetch(cid: string): Promise<RaffleImageMetadata | null> {
    try {
      console.log('🧪 Testing metadata fetch for CID:', cid);
      const pinataUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
      const response = await fetch(pinataUrl);
      
      if (response.ok) {
        const metadata = await response.json();
        console.log('✅ Test metadata fetch successful:', metadata);
        return metadata;
      } else {
        console.log('❌ Test metadata fetch failed:', response.status, response.statusText);
        return null;
      }
    } catch (error) {
      console.error('❌ Test metadata fetch error:', error);
      return null;
    }
  }

  /**
   * Debug method to manually set localStorage mapping for testing
   */
  static setTestMapping(raffleId: string, metadataCid: string): void {
    const key = `raffle_metadata_${raffleId}`;
    localStorage.setItem(key, metadataCid);
    console.log(`✅ Set test mapping: ${key} = ${metadataCid}`);
  }

  /**
   * Debug method to check localStorage mappings
   */
  static debugLocalStorageMappings(): void {
    console.log('🔍 All localStorage mappings:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('raffle_metadata_')) {
        console.log(`  ${key}: ${localStorage.getItem(key)}`);
      }
    }
  }

  /**
   * Test all gateways for a specific CID
   */
  static async testAllGateways(cid: string): Promise<{ gateway: string; success: boolean; response?: any }[]> {
    console.log('🧪 Testing all gateways for CID:', cid);
    const results = [];
    
    for (const gateway of IPFS_GATEWAYS) {
      try {
        const url = `${gateway}${cid}`;
        console.log(`🔍 Testing gateway: ${gateway}`);
        
        const response = await fetch(url, { 
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Gateway ${gateway} SUCCESS:`, data);
          results.push({ gateway, success: true, response: data });
        } else {
          console.log(`❌ Gateway ${gateway} FAILED:`, response.status, response.statusText);
          results.push({ gateway, success: false });
        }
      } catch (error) {
        console.log(`❌ Gateway ${gateway} ERROR:`, error);
        results.push({ gateway, success: false });
      }
    }
    
    return results;
  }
}

// Export singleton instance
export const ipfsMetadataService = IPFSMetadataService;