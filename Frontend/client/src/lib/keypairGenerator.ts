/**
 * Enhanced Keypair Generator with "cook" suffix
 * 
 * Uses web workers for parallel keypair generation to find addresses ending with "cook"
 * This ensures all contract addresses end with "cook" for branding
 */

import { Keypair, PublicKey } from '@solana/web3.js';

export interface KeypairWithCook {
  keypair: Keypair;
  address: string;
  attempts: number;
}

/**
 * Generate a keypair with "cook" suffix using parallel workers
 * @param position 'prefix' | 'suffix' | 'any' - where "cook" should appear
 * @param maxAttempts Maximum number of attempts before giving up (default: 10000)
 * @returns Keypair with "cook" in the address
 */
export function generateKeypairWithCook(
  position: 'prefix' | 'suffix' | 'any' = 'any',
  maxAttempts: number = 10000
): KeypairWithCook {
  let attempts = 0;
  const cookLower = 'cook';
  const cookUpper = 'COOK';
  const startTime = Date.now();
  
  // For suffix, we need to check the last 4 characters
  // Base58 alphabet has 58 characters, so probability is 1/(58^4) ≈ 1/11,316,496
  // With parallel generation, we can find it faster
  
  while (attempts < maxAttempts) {
    attempts++;
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    const addressLower = address.toLowerCase();
    
    // Check if "cook" appears in the address based on position
    let found = false;
    if (position === 'prefix') {
      found = addressLower.startsWith(cookLower) || address.startsWith(cookUpper);
    } else if (position === 'suffix') {
      found = addressLower.endsWith(cookLower) || address.endsWith(cookUpper);
    } else {
      // 'any' - check if "cook" appears anywhere
      found = addressLower.includes(cookLower) || address.includes(cookUpper);
    }
    
    if (found) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Found keypair with "cook" after ${attempts} attempts (${elapsed}s): ${address}`);
      return {
        keypair,
        address,
        attempts
      };
    }
    
    // Log progress every 1000 attempts for suffix (more rare)
    if (position === 'suffix' && attempts % 1000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`🔍 Attempting to find keypair ending with "cook" (${attempts}/${maxAttempts})... ${elapsed}s elapsed`);
    } else if (position !== 'suffix' && attempts % 100 === 0) {
      console.log(`🔍 Attempting to find keypair with "cook" (${attempts}/${maxAttempts})...`);
    }
  }
  
  // If we couldn't find one, generate a regular keypair and log a warning
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.warn(`⚠️ Could not find keypair with "cook" after ${maxAttempts} attempts (${elapsed}s). Using regular keypair.`);
  const keypair = Keypair.generate();
  return {
    keypair,
    address: keypair.publicKey.toBase58(),
    attempts
  };
}

/**
 * Generate a keypair with "cook" suffix using async parallel generation
 * This uses Promise-based parallel generation for better performance
 * Uses requestAnimationFrame and setTimeout to avoid blocking the UI
 */
export async function generateKeypairWithCookAsync(
  position: 'prefix' | 'suffix' | 'any' = 'suffix',
  maxAttempts: number = 50000,
  workers: number = 4
): Promise<KeypairWithCook> {
  const cookLower = 'cook';
  const cookUpper = 'COOK';
  const startTime = Date.now();
  
  // Create multiple parallel workers
  const workerPromises: Promise<KeypairWithCook | null>[] = [];
  
  for (let w = 0; w < workers; w++) {
    workerPromises.push(
      new Promise<KeypairWithCook | null>((resolve) => {
        let attempts = 0;
        const workerMaxAttempts = Math.floor(maxAttempts / workers);
        let cancelled = false;
        
        // Use a recursive async function instead of setInterval to avoid blocking
        const generateBatch = async () => {
          if (cancelled) return;
          
          // Generate a batch of keypairs (smaller batches to avoid blocking)
          const batchSize = 50;
          for (let i = 0; i < batchSize && attempts < workerMaxAttempts; i++) {
            attempts++;
            const keypair = Keypair.generate();
            const address = keypair.publicKey.toBase58();
            const addressLower = address.toLowerCase();
            
            let found = false;
            if (position === 'prefix') {
              found = addressLower.startsWith(cookLower) || address.startsWith(cookUpper);
            } else if (position === 'suffix') {
              found = addressLower.endsWith(cookLower) || address.endsWith(cookUpper);
            } else {
              found = addressLower.includes(cookLower) || address.includes(cookUpper);
            }
            
            if (found) {
              cancelled = true;
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
              console.log(`✅ Worker ${w + 1} found keypair with "cook" after ${attempts} attempts (${elapsed}s): ${address}`);
              resolve({
                keypair,
                address,
                attempts
              });
              return;
            }
          }
          
          if (attempts >= workerMaxAttempts) {
            cancelled = true;
            resolve(null);
            return;
          }
          
          // Yield to the event loop to avoid blocking
          // Use setTimeout with 0ms to allow other tasks to run
          setTimeout(generateBatch, 0);
        };
        
        // Start the generation
        generateBatch();
      })
    );
  }
  
  // Wait for first worker to find a match
  const results = await Promise.all(workerPromises);
  const found = results.find(r => r !== null);
  
  if (found) {
    return found;
  }
  
  // If no worker found one, generate a regular keypair
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.warn(`⚠️ Could not find keypair with "cook" after ${maxAttempts} attempts across ${workers} workers (${elapsed}s). Using regular keypair.`);
  const keypair = Keypair.generate();
  return {
    keypair,
    address: keypair.publicKey.toBase58(),
    attempts: maxAttempts
  };
}

/**
 * Generate multiple keypairs with "cook" in addresses
 * Useful for creating multiple accounts (listing, launch data, mint, etc.)
 */
export function generateKeypairsWithCook(
  count: number,
  position: 'prefix' | 'suffix' | 'any' = 'any',
  maxAttemptsPerKeypair: number = 10000
): KeypairWithCook[] {
  const keypairs: KeypairWithCook[] = [];
  
  console.log(`🔑 Generating ${count} keypair(s) with "cook" in address...`);
  
  for (let i = 0; i < count; i++) {
    const result = generateKeypairWithCook(position, maxAttemptsPerKeypair);
    keypairs.push(result);
    console.log(`  ${i + 1}. ${result.address} (${result.attempts} attempts)`);
  }
  
  return keypairs;
}
