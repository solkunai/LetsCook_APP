import { Connection, CommitmentLevel } from '@solana/web3.js';

/**
 * Get Solana connection using environment variable
 * Falls back to devnet only in development
 */
export function getConnection(commitment: CommitmentLevel = 'confirmed'): Connection {
  const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL;
  
  if (!rpcUrl) {
    if (import.meta.env.DEV) {
      console.warn('VITE_SOLANA_RPC_URL not set, using devnet fallback');
      return new Connection('https://api.devnet.solana.com', commitment);
    }
    throw new Error('VITE_SOLANA_RPC_URL environment variable is required in production');
  }

  return new Connection(rpcUrl, commitment);
}

/**
 * Get connection with custom timeout settings
 */
export function getConnectionWithTimeout(
  commitment: CommitmentLevel = 'confirmed',
  timeout: number = 60000
): Connection {
  const connection = getConnection(commitment);
  
  // Set timeout if supported
  if (connection && 'confirmTransactionInitialTimeout' in connection) {
    (connection as any).confirmTransactionInitialTimeout = timeout;
  }
  
  return connection;
}



