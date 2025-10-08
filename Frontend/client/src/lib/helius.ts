import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

export interface HeliusConfig {
  apiKey: string;
  network: 'devnet' | 'mainnet-beta';
  rpcUrl?: string;
}

export class HeliusAPI {
  private config: HeliusConfig;
  private connection: Connection;

  constructor(config: HeliusConfig) {
    this.config = config;
    this.rpcUrl = config.rpcUrl || `https://${config.network}.helius-rpc.com`;
    this.connection = new Connection(this.rpcUrl, 'confirmed');
  }

  get rpcUrl(): string {
    return `https://${this.config.network}.helius-rpc.com`;
  }

  set rpcUrl(url: string) {
    this.connection = new Connection(url, 'confirmed');
  }

  // Enhanced RPC methods with Helius optimizations
  async getAccountInfo(publicKey: PublicKey) {
    return await this.connection.getAccountInfo(publicKey);
  }

  async getProgramAccounts(programId: PublicKey, filters?: any[]) {
    return await this.connection.getProgramAccounts(programId, { filters });
  }

  async sendTransaction(transaction: Transaction | VersionedTransaction) {
    return await this.connection.sendTransaction(transaction);
  }

  async confirmTransaction(signature: string) {
    return await this.connection.confirmTransaction(signature);
  }

  // Helius-specific APIs
  async getAsset(assetId: string) {
    const response = await fetch(`${this.rpcUrl}/v0/token-metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'helius-test',
        method: 'getAsset',
        params: {
          id: assetId,
        },
      }),
    });

    return await response.json();
  }

  async searchAssets(query: any) {
    const response = await fetch(`${this.rpcUrl}/v0/token-metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'helius-test',
        method: 'searchAssets',
        params: query,
      }),
    });

    return await response.json();
  }

  async getTransactionHistory(address: string, limit = 100) {
    const response = await fetch(`${this.rpcUrl}/v0/addresses/${address}/transactions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return await response.json();
  }

  async getTokenAccounts(address: string) {
    const response = await fetch(`${this.rpcUrl}/v0/addresses/${address}/token-accounts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return await response.json();
  }

  // Priority fee estimation
  async getPriorityFeeEstimate(accounts: string[], options?: any) {
    const response = await fetch(`${this.rpcUrl}/v0/priority-fee`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'helius-test',
        method: 'getPriorityFeeEstimate',
        params: {
          accountKeys: accounts,
          options,
        },
      }),
    });

    return await response.json();
  }

  // Enhanced transaction parsing
  async parseTransaction(signature: string) {
    const response = await fetch(`${this.rpcUrl}/v0/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'helius-test',
        method: 'getTransaction',
        params: {
          signature,
          maxSupportedTransactionVersion: 0,
        },
      }),
    });

    return await response.json();
  }

  // Webhook support for real-time updates
  async createWebhook(webhookUrl: string, events: string[]) {
    const response = await fetch(`${this.rpcUrl}/v0/webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        webhookURL: webhookUrl,
        transactionTypes: events,
        accountAddresses: [],
        webhookType: 'enhanced',
      }),
    });

    return await response.json();
  }

  // Get connection instance for direct Solana operations
  getConnection(): Connection {
    return this.connection;
  }
}

// Singleton instance
let heliusInstance: HeliusAPI | null = null;

export function getHeliusAPI(): HeliusAPI {
  if (!heliusInstance) {
    const apiKey = import.meta.env.VITE_HELIUS_API_KEY || '90f9fe0f-400f-4368-bc82-26d2a91b1da6';
    const network = import.meta.env.VITE_HELIUS_NETWORK || 'devnet';
    
    if (!apiKey) {
      throw new Error('Helius API key not found. Please set VITE_HELIUS_API_KEY in your environment variables.');
    }

    heliusInstance = new HeliusAPI({
      apiKey,
      network: network as 'devnet' | 'mainnet-beta',
    });
  }

  return heliusInstance;
}

export default HeliusAPI;