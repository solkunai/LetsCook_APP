import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { getHeliusAPI } from './helius';
import { TransactionService, createLaunchInstruction, createBuyTicketsInstruction, createHypeVoteInstruction } from './transactions';
import { getBackendIntegration } from './backendIntegration';

// Program IDs - HARDCODED FOR TESTING
export const PROGRAM_IDS = {
  MAIN_PROGRAM: new PublicKey('Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU'),
  CITIZENS_PROGRAM: new PublicKey('Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU'),
  LISTINGS_PROGRAM: new PublicKey('Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU'),
  TRANSFER_HOOK_PROGRAM: new PublicKey('Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU'),
  RAYDIUM_AMM_PROGRAM: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),
  RAYDIUM_LIQUIDITY_PROGRAM: new PublicKey('27haf8L6oxUeXrHrgEgsexjSY5hbVUWEmvv9Nyxg8vQv'),
};

// Instruction discriminators - Update these with actual values from your programs
export const INSTRUCTION_DISCRIMINATORS = {
  // Main Program Instructions
  INIT: Buffer.from([0x8f, 0x4c, 0x2d, 0x1a, 0x3b, 0x5c, 0x7e, 0x9f]), // Init
  CREATE_LAUNCH: Buffer.from([0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x7a, 0x8b]), // CreateLaunch
  CREATE_INSTANT_LAUNCH: Buffer.from([0x2a, 0x3b, 0x4c, 0x5d, 0x6e, 0x7f, 0x8a, 0x9b]), // CreateInstantLaunch
  BUY_TICKETS: Buffer.from([0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x7a, 0x8b, 0x9c]), // BuyTickets
  CHECK_TICKETS: Buffer.from([0x3c, 0x4d, 0x5e, 0x6f, 0x7a, 0x8b, 0x9c, 0xad]), // CheckTickets
  INIT_COOK_AMM: Buffer.from([0x4d, 0x5e, 0x6f, 0x7a, 0x8b, 0x9c, 0xad, 0xbe]), // InitCookAMM
  HYPE_VOTE: Buffer.from([0x5e, 0x6f, 0x7a, 0x8b, 0x9c, 0xad, 0xbe, 0xcf]), // HypeVote
  CLAIM_REFUND: Buffer.from([0x6f, 0x7a, 0x8b, 0x9c, 0xad, 0xbe, 0xcf, 0xda]), // ClaimRefund
  EDIT_LAUNCH: Buffer.from([0x7a, 0x8b, 0x9c, 0xad, 0xbe, 0xcf, 0xda, 0xeb]), // EditLaunch
  CLAIM_TOKENS: Buffer.from([0x8b, 0x9c, 0xad, 0xbe, 0xcf, 0xda, 0xeb, 0xfc]), // ClaimTokens
  SET_NAME: Buffer.from([0x9c, 0xad, 0xbe, 0xcf, 0xda, 0xeb, 0xfc, 0x0d]), // SetName
  
  // Citizens Program Instructions
  START_MISSION: Buffer.from([0xad, 0xbe, 0xcf, 0xda, 0xeb, 0xfc, 0x0d, 0x1e]), // StartMission
  RESOLVE_MISSION: Buffer.from([0xbe, 0xcf, 0xda, 0xeb, 0xfc, 0x0d, 0x1e, 0x2f]), // ResolveMission
  BETRAY_MISSION: Buffer.from([0xcf, 0xda, 0xeb, 0xfc, 0x0d, 0x1e, 0x2f, 0x3a]), // BetrayMission
  
  // Listings Program Instructions
  CREATE_LISTING: Buffer.from([0xda, 0xeb, 0xfc, 0x0d, 0x1e, 0x2f, 0x3a, 0x4b]), // CreateListing
  REMOVE_LISTING: Buffer.from([0xeb, 0xfc, 0x0d, 0x1e, 0x2f, 0x3a, 0x4b, 0x5c]), // RemoveListing
  BUY_NFT: Buffer.from([0xfc, 0x0d, 0x1e, 0x2f, 0x3a, 0x4b, 0x5c, 0x6d]), // BuyNFT
};

// Types
export interface LaunchData {
  id: string;
  name: string;
  symbol: string;
  uri: string;
  icon: string;
  banner: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  totalSupply: number;
  decimals: number;
  launchDate?: number;
  closeDate?: number;
  numMints?: number;
  ticketPrice?: number;
  pageName: string;
  transferFee: number;
  maxTransferFee: number;
  extensions: number;
  ammProvider: number;
  launchType: 'raffle' | 'instant' | number;
  whitelistTokens: number;
  whitelistEnd: number;
  status: 'upcoming' | 'active' | 'ended' | 'claimed';
  totalTicketsSold: number;
  hypeScore: number;
  liquidityThreshold: number;
  currentLiquidity: number;
}

export interface TicketData {
  launchId: string;
  ticketId: string;
  owner: string;
  purchaseDate: number;
  price: number;
  status: 'active' | 'won' | 'lost' | 'refunded';
}

export interface MissionData {
  id: string;
  difficulty: number;
  seed: string;
  status: 'active' | 'completed' | 'betrayed';
  startDate: number;
  endDate?: number;
  reward: number;
}

export interface ListingData {
  id: string;
  assetId: string;
  price: number;
  seller: string;
  status: 'active' | 'sold' | 'cancelled';
  createdAt: number;
}

// Base API class
abstract class BaseAPI {
  protected connection: Connection;
  protected wallet: any;
  protected programId: PublicKey;

  constructor(connection: Connection, wallet: any, programId: PublicKey) {
    this.connection = connection;
    this.wallet = wallet;
    this.programId = programId;
  }

  protected async sendTransaction(transaction: Transaction): Promise<string> {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (!this.wallet.signTransaction) {
      throw new Error('Wallet does not support signing transactions');
    }

    // Set recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    // Sign and send transaction
    const signedTransaction = await this.wallet.signTransaction(transaction);
    const signature = await this.connection.sendTransaction(signedTransaction);
    
    // Confirm transaction
    await this.connection.confirmTransaction(signature);

    return signature;
  }

  protected createInstruction(discriminator: Buffer, data: Buffer): any {
    return {
      programId: this.programId,
      keys: [],
      data: Buffer.concat([discriminator, data]),
    };
  }
}

// Launch API
export class LaunchAPI extends BaseAPI {
  private transactionService: TransactionService;
  private backendIntegration: any;

  constructor(connection: Connection, wallet: any) {
    super(connection, wallet, PROGRAM_IDS.MAIN_PROGRAM);
    this.transactionService = new TransactionService();
    this.backendIntegration = getBackendIntegration();
  }

  async createLaunch(launchData: Partial<LaunchData>): Promise<string> {
    console.log('🔧 API Service: createLaunch called with:', launchData);
    
    if (!this.wallet?.publicKey) {
      console.log('❌ API Service: Wallet not connected');
      throw new Error('Wallet not connected');
    }

    try {
      console.log('🔧 API Service: Creating launch transaction...');
      // Create the complete launch transaction with all required accounts
      const transaction = await this.backendIntegration.createLaunchTransaction(
        this.wallet.publicKey,
        launchData
      );
      console.log('✅ API Service: Transaction created successfully');

      console.log('🔧 API Service: Sending transaction with wallet...');
      // Send transaction with wallet signing
      const result = await this.transactionService.sendTransactionWithWallet(
        transaction,
        this.wallet
      );
      console.log('🔧 API Service: Transaction result:', result);

      if (!result.success) {
        console.log('❌ API Service: Transaction failed:', result.error);
        throw new Error(result.error || 'Transaction failed');
      }

      console.log('✅ API Service: Launch created successfully!');
      return result.signature;
    } catch (error) {
      console.error('❌ API Service: Error creating launch:', error);
      throw error;
    }
  }

  async buyTickets(params: { launchId: string; numTickets: number }): Promise<string> {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      // Create the complete buy tickets transaction
      const transaction = await this.backendIntegration.createBuyTicketsTransaction(
        this.wallet.publicKey,
        params.launchId,
        params.numTickets
      );

      // Send transaction with wallet signing
      const result = await this.transactionService.sendTransactionWithWallet(
        transaction,
        this.wallet
      );

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      return result.signature;
    } catch (error) {
      console.error('Error buying tickets:', error);
      throw error;
    }
  }

  async hypeVote(params: { launchId: string; vote: number }): Promise<string> {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      // Create the complete hype vote transaction
      const transaction = await this.backendIntegration.createHypeVoteTransaction(
        this.wallet.publicKey,
        params.launchId,
        params.vote
      );

      // Send transaction with wallet signing
      const result = await this.transactionService.sendTransactionWithWallet(
        transaction,
        this.wallet
      );

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      return result.signature;
    } catch (error) {
      console.error('Error voting on hype:', error);
      throw error;
    }
  }

  async claimTokens(launchId: string): Promise<string> {
    const transaction = new Transaction();
    
    const data = Buffer.alloc(64);
    const launchIdBytes = Buffer.from(launchId, 'utf8');
    data.writeUInt32LE(launchIdBytes.length, 0);
    launchIdBytes.copy(data, 4);
    
    const instruction = this.createInstruction(INSTRUCTION_DISCRIMINATORS.CLAIM_TOKENS, data.slice(0, 4 + launchIdBytes.length));
    transaction.add(instruction);

    return await this.sendTransaction(transaction);
  }

  async editLaunch(params: { launchId: string; updates: Partial<LaunchData> }): Promise<string> {
    const transaction = new Transaction();

    const data = Buffer.alloc(1024);
    let offset = 0;
    
    const launchIdBytes = Buffer.from(params.launchId, 'utf8');
    data.writeUInt32LE(launchIdBytes.length, offset);
    offset += 4;
    launchIdBytes.copy(data, offset);
    offset += launchIdBytes.length;
    
    // Serialize updates...
    
    const instruction = this.createInstruction(INSTRUCTION_DISCRIMINATORS.EDIT_LAUNCH, data.slice(0, offset));
    transaction.add(instruction);

    return await this.sendTransaction(transaction);
  }

  // Data fetching methods
  async getAllLaunches(): Promise<LaunchData[]> {
    try {
      // Use the backend integration to get real launch data
      return await this.backendIntegration.getAllLaunches();
    } catch (error) {
      console.error('Error fetching launches:', error);
      return [];
    }
  }

  private parseLaunchAccount(data: Buffer): LaunchData {
    // This is a simplified parser - implement based on your program's account structure
    let offset = 8; // Skip discriminator
    
    const nameLength = data.readUInt32LE(offset);
    offset += 4;
    const name = data.toString('utf8', offset, offset + nameLength);
    offset += nameLength;
    
    // Parse other fields...
    
    return {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      symbol: 'TKN',
      uri: '',
      icon: '',
      banner: '',
      totalSupply: 1000000,
      decimals: 9,
      launchDate: Date.now() / 1000,
      closeDate: Date.now() / 1000 + 86400,
      numMints: 1000,
      ticketPrice: 0.1 * LAMPORTS_PER_SOL,
      pageName: name.toLowerCase().replace(/\s+/g, '-'),
      transferFee: 0,
      maxTransferFee: 0,
      extensions: 0,
      ammProvider: 0,
      launchType: 0,
      whitelistTokens: 0,
      whitelistEnd: 0,
      status: 'upcoming',
      totalTicketsSold: 0,
      hypeScore: 0,
      liquidityThreshold: 0,
      currentLiquidity: 0,
    };
  }
}

// Citizens API
export class CitizensAPI extends BaseAPI {
  private backendIntegration: any;
  private transactionService: TransactionService;

  constructor(connection: Connection, wallet: any) {
    super(connection, wallet, PROGRAM_IDS.CITIZENS_PROGRAM);
    this.backendIntegration = getBackendIntegration();
    this.transactionService = new TransactionService();
  }

  async startMission(params: { difficulty: number; seed: string }): Promise<string> {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      // Create the complete mission transaction
      const transaction = await this.backendIntegration.createMissionTransaction(
        this.wallet.publicKey,
        params.difficulty,
        params.seed
      );

      // Send transaction with wallet signing
      const result = await this.transactionService.sendTransactionWithWallet(
        transaction,
        this.wallet
      );

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      return result.signature;
    } catch (error) {
      console.error('Error starting mission:', error);
      throw error;
    }
  }

  async resolveMission(missionId: string): Promise<string> {
    const transaction = new Transaction();
    
    const data = Buffer.alloc(64);
    const missionIdBytes = Buffer.from(missionId, 'utf8');
    data.writeUInt32LE(missionIdBytes.length, 0);
    missionIdBytes.copy(data, 4);
    
    const instruction = this.createInstruction(INSTRUCTION_DISCRIMINATORS.RESOLVE_MISSION, data.slice(0, 4 + missionIdBytes.length));
    transaction.add(instruction);

    return await this.sendTransaction(transaction);
  }
}

// Listings API
export class ListingsAPI extends BaseAPI {
  private backendIntegration: any;
  private transactionService: TransactionService;

  constructor(connection: Connection, wallet: any) {
    super(connection, wallet, PROGRAM_IDS.LISTINGS_PROGRAM);
    this.backendIntegration = getBackendIntegration();
    this.transactionService = new TransactionService();
  }

  async createListing(params: { assetId: string; price: number }): Promise<string> {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      // Create the complete listing transaction
      const transaction = await this.backendIntegration.createListingTransaction(
        this.wallet.publicKey,
        params.assetId,
        params.price
      );

      // Send transaction with wallet signing
      const result = await this.transactionService.sendTransactionWithWallet(
        transaction,
        this.wallet
      );

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      return result.signature;
    } catch (error) {
      console.error('Error creating listing:', error);
      throw error;
    }
  }

  async removeListing(listingId: string): Promise<string> {
    const transaction = new Transaction();
    
    const data = Buffer.alloc(64);
    const listingIdBytes = Buffer.from(listingId, 'utf8');
    data.writeUInt32LE(listingIdBytes.length, 0);
    listingIdBytes.copy(data, 4);
    
    const instruction = this.createInstruction(INSTRUCTION_DISCRIMINATORS.REMOVE_LISTING, data.slice(0, 4 + listingIdBytes.length));
    transaction.add(instruction);

    return await this.sendTransaction(transaction);
  }
}

// Main API Services class
export class APIServices {
  public launch: LaunchAPI;
  public citizens: CitizensAPI;
  public listings: ListingsAPI;
  private helius: any;

  constructor(connection: Connection, wallet: any) {
    this.launch = new LaunchAPI(connection, wallet);
    this.citizens = new CitizensAPI(connection, wallet);
    this.listings = new ListingsAPI(connection, wallet);
    this.helius = getHeliusAPI();
  }

  // Enhanced methods using Helius
  async getEnhancedTransactionHistory(address: string) {
    return await this.helius.getTransactionHistory(address);
  }

  async getTokenAccounts(address: string) {
    return await this.helius.getTokenAccounts(address);
  }

  async getAssetMetadata(assetId: string) {
    return await this.helius.getAsset(assetId);
  }

  async searchAssets(query: any) {
    return await this.helius.searchAssets(query);
  }

  async getPriorityFeeEstimate(accounts: string[]) {
    return await this.helius.getPriorityFeeEstimate(accounts);
  }
}

// React hook for using API services
export function useAPIServices(): APIServices {
  const { publicKey, signTransaction } = useWallet();
  const helius = getHeliusAPI();
  const connection = helius.getConnection();

  const wallet = {
    publicKey,
    signTransaction,
  };

  return new APIServices(connection, wallet);
}

export default APIServices;