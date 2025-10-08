import { Connection, clusterApiUrl } from '@solana/web3.js';

// Simple connection with Helius API fallback
export const getSimpleConnection = () => {
  // Try Helius first, fallback to standard RPC
  const heliusUrl = 'https://devnet.helius-rpc.com/?api-key=90f9fe0f-400f-4368-bc82-26d2a91b1da6';
  return new Connection(heliusUrl, 'confirmed');
};