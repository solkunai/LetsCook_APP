import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

// Program ID from your deployed native Solana program
export const PROGRAM_ID = new PublicKey('J3Qr5TAMocTrPXrJbjH86jLQ3bCXJaS4hFgaE54zT2jg');

// Network configuration
export const NETWORK = {
  devnet: clusterApiUrl('devnet'),
  mainnet: 'https://api.mainnet-beta.solana.com',
  localhost: 'http://localhost:8899',
} as const;

// Default connection (devnet for development)
export const connection = new Connection(NETWORK.devnet, 'confirmed');

// Helper function to get connection for different networks
export function getConnection(network: keyof typeof NETWORK = 'devnet') {
  return new Connection(NETWORK[network], 'confirmed');
}

// Common account addresses
export const COMMON_ADDRESSES = {
  SYSTEM_PROGRAM: new PublicKey('11111111111111111111111111111111'),
  TOKEN_PROGRAM: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
  ASSOCIATED_TOKEN_PROGRAM: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
  RENT: new PublicKey('SysvarRent111111111111111111111111111111111'),
} as const;

// Error handling
export class SolanaError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'SolanaError';
  }
}

// Transaction helpers
export async function getRecentBlockhash() {
  return await connection.getRecentBlockhash();
}

export async function getAccountInfo(publicKey: PublicKey) {
  return await connection.getAccountInfo(publicKey);
}

export async function getBalance(publicKey: PublicKey) {
  return await connection.getBalance(publicKey);
}