import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { getSimpleConnection } from './simpleConnection';

// Program ID from our deployed program
const PROGRAM_ID = new PublicKey(import.meta.env.VITE_MAIN_PROGRAM_ID || "ygnLL5qWn11qkxtjLXBrP61oapijCrygpmpq3k2LkEJ");

// Simple instruction discriminator for our basic program
const CREATE_LAUNCH_DISCRIMINATOR = new Uint8Array([0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x7a, 0x8b]);

export class SimpleDirectProgramService {
  private connection: Connection;

  constructor() {
    this.connection = getSimpleConnection();
  }

  // Instant launch creation
  async createInstantLaunch(
    wallet: any,
    launchData: {
      name: string;
      symbol: string;
      description: string;
      totalSupply: number;
      decimals: number;
      initialPrice?: number;
      liquidityAmount?: number;
      launchType: 'instant';
      programId: string;
      walletAddress: string;
    }
  ): Promise<string> {
    return this.createLaunch(wallet, { ...launchData, launchType: 'instant' });
  }

  // Raffle launch creation
  async createRaffleLaunch(
    wallet: any,
    launchData: {
      name: string;
      symbol: string;
      description: string;
      totalSupply: number;
      decimals: number;
      ticketPrice?: number;
      maxTickets?: number;
      raffleDuration?: number;
      winnerCount?: number;
      launchType: 'raffle';
      programId: string;
      walletAddress: string;
    }
  ): Promise<string> {
    return this.createLaunch(wallet, { ...launchData, launchType: 'raffle' });
  }

  // Generic launch creation that works with our basic program
  async createLaunch(
    wallet: any,
    launchData: {
      name: string;
      symbol: string;
      description: string;
      totalSupply: number;
      decimals: number;
      launchType: 'instant' | 'raffle';
      programId: string;
      walletAddress: string;
      [key: string]: any; // Allow additional properties
    }
  ): Promise<string> {
    try {
      console.log('🚀 SimpleDirectProgram: Creating simple launch with data:', launchData);
      console.log('🎯 SimpleDirectProgram: Launch type:', launchData.launchType || 'default');
      console.log('🔍 SimpleDirectProgram: Wallet object:', wallet);
      console.log('🔍 SimpleDirectProgram: Wallet publicKey:', wallet?.publicKey);
      console.log('🔍 SimpleDirectProgram: Wallet adapter:', wallet?.adapter);

      // Validate wallet and publicKey
      if (!wallet) {
        throw new Error('Wallet is not provided');
      }
      
      if (!wallet.publicKey) {
        throw new Error('Wallet publicKey is not available. Please connect your wallet.');
      }

      if (!wallet.adapter) {
        throw new Error('Wallet adapter is not available');
      }

      // Create a simple instruction that our basic program can handle
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: this.serializeLaunchData(launchData),
      });

      // Create transaction
      const transaction = new Transaction().add(instruction);

      // Set recent blockhash
      console.log('🔍 SimpleDirectProgram: Getting latest blockhash...');
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      console.log('📝 SimpleDirectProgram: Transaction created, sending...');
      console.log('🔍 SimpleDirectProgram: Transaction details:', {
        recentBlockhash: transaction.recentBlockhash,
        feePayer: transaction.feePayer?.toString(),
        instructions: transaction.instructions.length
      });

      // Send transaction using proper wallet handling
      console.log('🔍 SimpleDirectProgram: Sending transaction...');
      let signature;

      if (wallet.adapter?.sendTransaction) {
        // For wallet-adapter-react (most setups) - call on adapter to maintain this context
        console.log('🔍 SimpleDirectProgram: Using wallet.adapter.sendTransaction...');
        signature = await wallet.adapter.sendTransaction(transaction, this.connection);
      } else if (wallet.signTransaction && wallet.publicKey) {
        // For Phantom / Solflare direct API
        console.log('🔍 SimpleDirectProgram: Using wallet.signTransaction...');
        const signedTx = await wallet.signTransaction(transaction);
        signature = await this.connection.sendRawTransaction(signedTx.serialize());
      } else {
        throw new Error("Unsupported wallet object - no sendTransaction or signTransaction method found");
      }
      
      console.log('⏳ SimpleDirectProgram: Waiting for confirmation...');
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ SimpleDirectProgram: Launch created successfully!', signature);
      return signature;

    } catch (error) {
      console.error('❌ SimpleDirectProgram: Error creating launch:', error);
      throw error;
    }
  }

  // Serialize launch data for our simple program using Buffer
  private serializeLaunchData(data: {
    name: string;
    symbol: string;
    description: string;
    totalSupply: number;
    decimals: number;
    launchType: 'instant' | 'raffle';
    programId: string;
    walletAddress: string;
    [key: string]: any;
  }): Buffer {
    // Create a comprehensive data structure that our program can understand
    const buffer = new Uint8Array(2048); // Increased space for more data
    let offset = 0;

    // Add discriminator
    buffer.set(CREATE_LAUNCH_DISCRIMINATOR, offset);
    offset += CREATE_LAUNCH_DISCRIMINATOR.length;

    // Add launch type (1 byte: 0 = instant, 1 = raffle)
    buffer[offset] = data.launchType === 'instant' ? 0 : 1;
    offset += 1;

    // Add name (32 bytes max)
    const nameBytes = new TextEncoder().encode(data.name.padEnd(32, '\0').slice(0, 32));
    buffer.set(nameBytes, offset);
    offset += 32;

    // Add symbol (8 bytes max)
    const symbolBytes = new TextEncoder().encode(data.symbol.padEnd(8, '\0').slice(0, 8));
    buffer.set(symbolBytes, offset);
    offset += 8;

    // Add total supply (8 bytes, u64) - little endian
    const supplyBytes = new Uint8Array(8);
    const supplyView = new DataView(supplyBytes.buffer);
    supplyView.setBigUint64(0, BigInt(data.totalSupply), true);
    buffer.set(supplyBytes, offset);
    offset += 8;

    // Add decimals (1 byte, u8)
    buffer[offset] = data.decimals;
    offset += 1;

    // Add description length and data
    const descriptionBytes = new TextEncoder().encode(data.description);
    const descLengthBytes = new Uint8Array(4);
    const descLengthView = new DataView(descLengthBytes.buffer);
    descLengthView.setUint32(0, descriptionBytes.length, true);
    buffer.set(descLengthBytes, offset);
    offset += 4;
    buffer.set(descriptionBytes, offset);
    offset += descriptionBytes.length;

    // Add launch-specific data based on type
    if (data.launchType === 'instant') {
      // Add initial price (8 bytes, u64)
      const initialPriceBytes = new Uint8Array(8);
      const initialPriceView = new DataView(initialPriceBytes.buffer);
      initialPriceView.setBigUint64(0, BigInt(Math.floor((data.initialPrice || 0) * 1e9)), true);
      buffer.set(initialPriceBytes, offset);
      offset += 8;

      // Add liquidity amount (8 bytes, u64)
      const liquidityBytes = new Uint8Array(8);
      const liquidityView = new DataView(liquidityBytes.buffer);
      liquidityView.setBigUint64(0, BigInt(Math.floor((data.liquidityAmount || 0) * 1e9)), true);
      buffer.set(liquidityBytes, offset);
      offset += 8;
    } else if (data.launchType === 'raffle') {
      // Add ticket price (8 bytes, u64)
      const ticketPriceBytes = new Uint8Array(8);
      const ticketPriceView = new DataView(ticketPriceBytes.buffer);
      ticketPriceView.setBigUint64(0, BigInt(Math.floor((data.ticketPrice || 0) * 1e9)), true);
      buffer.set(ticketPriceBytes, offset);
      offset += 8;

      // Add max tickets (4 bytes, u32)
      const maxTicketsBytes = new Uint8Array(4);
      const maxTicketsView = new DataView(maxTicketsBytes.buffer);
      maxTicketsView.setUint32(0, data.maxTickets || 0, true);
      buffer.set(maxTicketsBytes, offset);
      offset += 4;

      // Add raffle duration (4 bytes, u32)
      const durationBytes = new Uint8Array(4);
      const durationView = new DataView(durationBytes.buffer);
      durationView.setUint32(0, data.raffleDuration || 0, true);
      buffer.set(durationBytes, offset);
      offset += 4;

      // Add winner count (4 bytes, u32)
      const winnerCountBytes = new Uint8Array(4);
      const winnerCountView = new DataView(winnerCountBytes.buffer);
      winnerCountView.setUint32(0, data.winnerCount || 0, true);
      buffer.set(winnerCountBytes, offset);
      offset += 4;
    }

    return Buffer.from(buffer.slice(0, offset));
  }

  // Test connection to our program
  async testProgramConnection(): Promise<boolean> {
    try {
      console.log('🔍 SimpleDirectProgram: Testing connection to program...');
      
      // Try to get account info for our program
      const programInfo = await this.connection.getAccountInfo(PROGRAM_ID);
      
      if (programInfo) {
        console.log('✅ SimpleDirectProgram: Program found on devnet!', {
          programId: PROGRAM_ID.toString(),
          executable: programInfo.executable,
          owner: programInfo.owner.toString(),
          lamports: programInfo.lamports
        });
        return true;
      } else {
        console.log('❌ SimpleDirectProgram: Program not found on devnet');
        return false;
      }
    } catch (error) {
      console.error('❌ SimpleDirectProgram: Error testing connection:', error);
      return false;
    }
  }

  // Request airdrop for testing
  async requestAirdrop(wallet: any): Promise<boolean> {
    try {
      console.log('💰 SimpleDirectProgram: Requesting airdrop...');
      const signature = await this.connection.requestAirdrop(
        wallet.publicKey, 
        2 * LAMPORTS_PER_SOL
      );
      
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      const balance = await this.connection.getBalance(wallet.publicKey);
      console.log('✅ SimpleDirectProgram: Airdrop successful! New balance:', balance / LAMPORTS_PER_SOL, 'SOL');
      
      return true;
    } catch (error) {
      console.error('❌ SimpleDirectProgram: Airdrop failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const simpleDirectProgramService = new SimpleDirectProgramService();