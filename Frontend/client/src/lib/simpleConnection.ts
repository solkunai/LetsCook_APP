import { Connection, clusterApiUrl } from '@solana/web3.js';

// Simple connection using standard Solana RPC to avoid CORS issues
export const getSimpleConnection = () => {
  // Use standard Solana devnet RPC to avoid CORS issues
  return new Connection(clusterApiUrl('devnet'), 'confirmed');
};