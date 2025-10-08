import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  AccountMeta,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { getHeliusAPI } from './helius';
import { PROGRAM_IDS, INSTRUCTION_DISCRIMINATORS } from './apiServices';

// Backend Integration Service
export class BackendIntegration {
  private connection: Connection;
  private helius: any;

  constructor() {
    this.helius = getHeliusAPI();
    this.connection = this.helius.getConnection();
  }

  // Get connection
  getConnection(): Connection {
    return this.connection;
  }

  // Derive PDAs for the main program
  async deriveMainProgramPDAs(launchId: string, user: PublicKey) {
    const [cookDataPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('cook_data')],
      PROGRAM_IDS.MAIN_PROGRAM
    );

    const [cookPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('cook_pda')],
      PROGRAM_IDS.MAIN_PROGRAM
    );

    const [launchDataPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('launch_data'), Buffer.from(launchId)],
      PROGRAM_IDS.MAIN_PROGRAM
    );

    const [userDataPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_data'), user.toBuffer()],
      PROGRAM_IDS.MAIN_PROGRAM
    );

    const [joinDataPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('join_data'), user.toBuffer(), Buffer.from(launchId)],
      PROGRAM_IDS.MAIN_PROGRAM
    );

    return {
      cookDataPDA,
      cookPDA,
      launchDataPDA,
      userDataPDA,
      joinDataPDA,
    };
  }

  // Create a complete launch transaction with all required accounts
  async createLaunchTransaction(
    user: PublicKey,
    launchData: any
  ): Promise<Transaction> {
    const transaction = new Transaction();
    
    // Derive PDAs
    const pdas = await this.deriveMainProgramPDAs(launchData.pageName, user);
    
    // Choose instruction based on launch type
    const instruction = launchData.launchType === 'instant' 
      ? this.createInstantLaunchInstruction(user, pdas, launchData)
      : this.createRaffleLaunchInstruction(user, pdas, launchData);

    transaction.add(instruction);
    return transaction;
  }

  // Create raffle launch instruction
  private createRaffleLaunchInstruction(
    user: PublicKey,
    pdas: any,
    launchData: any
  ): TransactionInstruction {
    return new TransactionInstruction({
      programId: PROGRAM_IDS.MAIN_PROGRAM,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: pdas.launchDataPDA, isSigner: false, isWritable: true },
        { pubkey: pdas.cookDataPDA, isSigner: false, isWritable: true },
        { pubkey: pdas.cookPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: this.serializeCreateLaunchArgs(launchData),
    });
  }

  // Create instant launch instruction
  private createInstantLaunchInstruction(
    user: PublicKey,
    pdas: any,
    launchData: any
  ): TransactionInstruction {
    return new TransactionInstruction({
      programId: PROGRAM_IDS.MAIN_PROGRAM,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: pdas.launchDataPDA, isSigner: false, isWritable: true },
        { pubkey: pdas.cookDataPDA, isSigner: false, isWritable: true },
        { pubkey: pdas.cookPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: this.serializeInstantLaunchArgs(launchData),
    });
  }

  // Create buy tickets transaction
  async createBuyTicketsTransaction(
    user: PublicKey,
    launchId: string,
    numTickets: number
  ): Promise<Transaction> {
    const transaction = new Transaction();
    
    // Derive PDAs
    const pdas = await this.deriveMainProgramPDAs(launchId, user);
    
    // Create the buy tickets instruction
    const instruction = new TransactionInstruction({
      programId: PROGRAM_IDS.MAIN_PROGRAM,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: pdas.userDataPDA, isSigner: false, isWritable: true },
        { pubkey: pdas.joinDataPDA, isSigner: false, isWritable: true },
        { pubkey: pdas.launchDataPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: this.serializeBuyTicketsArgs(numTickets),
    });

    transaction.add(instruction);
    return transaction;
  }

  // Create hype vote transaction
  async createHypeVoteTransaction(
    user: PublicKey,
    launchId: string,
    vote: number
  ): Promise<Transaction> {
    const transaction = new Transaction();
    
    // Derive PDAs
    const pdas = await this.deriveMainProgramPDAs(launchId, user);
    
    // Create the hype vote instruction
    const instruction = new TransactionInstruction({
      programId: PROGRAM_IDS.MAIN_PROGRAM,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: pdas.userDataPDA, isSigner: false, isWritable: true },
        { pubkey: pdas.launchDataPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: this.serializeHypeVoteArgs(vote),
    });

    transaction.add(instruction);
    return transaction;
  }

  // Serialize CreateArgs for the backend
  private serializeCreateLaunchArgs(launchData: any): Buffer {
    const args = {
      name: launchData.name || '',
      symbol: launchData.symbol || '',
      uri: launchData.uri || '',
      icon: launchData.icon || '',
      banner: launchData.banner || '',
      total_supply: launchData.totalSupply || 0,
      decimals: launchData.decimals || 9,
      launch_date: launchData.launchDate || 0,
      close_date: launchData.closeDate || 0,
      num_mints: launchData.numMints || 0,
      ticket_price: launchData.ticketPrice || 0,
      page_name: launchData.pageName || '',
      transfer_fee: launchData.transferFee || 0,
      max_transfer_fee: launchData.maxTransferFee || 0,
      extensions: launchData.extensions || 0,
      amm_provider: launchData.ammProvider || 0,
      launch_type: launchData.launchType || 0,
      whitelist_tokens: launchData.whitelistTokens || 0,
      whitelist_end: launchData.whitelistEnd || 0,
    };

    // Serialize using Borsh-like format
    const buffer = Buffer.alloc(2048);
    let offset = 0;

    // Add discriminator
    INSTRUCTION_DISCRIMINATORS.CREATE_LAUNCH.copy(buffer, offset);
    offset += INSTRUCTION_DISCRIMINATORS.CREATE_LAUNCH.length;

    // Serialize string fields
    const serializeString = (str: string) => {
      const strBytes = Buffer.from(str, 'utf8');
      buffer.writeUInt32LE(strBytes.length, offset);
      offset += 4;
      strBytes.copy(buffer, offset);
      offset += strBytes.length;
    };

    serializeString(args.name);
    serializeString(args.symbol);
    serializeString(args.uri);
    serializeString(args.icon);
    serializeString(args.banner);
    serializeString(args.page_name);

    // Serialize numeric fields
    buffer.writeUInt64LE(args.total_supply, offset);
    offset += 8;
    buffer.writeUInt8(args.decimals, offset);
    offset += 1;
    buffer.writeUInt64LE(args.launch_date, offset);
    offset += 8;
    buffer.writeUInt64LE(args.close_date, offset);
    offset += 8;
    buffer.writeUInt32LE(args.num_mints, offset);
    offset += 4;
    buffer.writeUInt64LE(args.ticket_price, offset);
    offset += 8;
    buffer.writeUInt16LE(args.transfer_fee, offset);
    offset += 2;
    buffer.writeUInt64LE(args.max_transfer_fee, offset);
    offset += 8;
    buffer.writeUInt8(args.extensions, offset);
    offset += 1;
    buffer.writeUInt8(args.amm_provider, offset);
    offset += 1;
    buffer.writeUInt8(args.launch_type, offset);
    offset += 1;
    buffer.writeUInt64LE(args.whitelist_tokens, offset);
    offset += 8;
    buffer.writeUInt64LE(args.whitelist_end, offset);
    offset += 8;

    return buffer.slice(0, offset);
  }

  // Serialize JoinArgs for buy tickets
  private serializeBuyTicketsArgs(numTickets: number): Buffer {
    const buffer = Buffer.alloc(64);
    let offset = 0;

    // Add discriminator
    INSTRUCTION_DISCRIMINATORS.BUY_TICKETS.copy(buffer, offset);
    offset += INSTRUCTION_DISCRIMINATORS.BUY_TICKETS.length;

    // Serialize args
    buffer.writeUInt32LE(numTickets, offset);
    offset += 4;

    return buffer.slice(0, offset);
  }

  // Serialize VoteArgs for hype voting
  private serializeHypeVoteArgs(vote: number): Buffer {
    const buffer = Buffer.alloc(64);
    let offset = 0;

    // Add discriminator
    INSTRUCTION_DISCRIMINATORS.HYPE_VOTE.copy(buffer, offset);
    offset += INSTRUCTION_DISCRIMINATORS.HYPE_VOTE.length;

    // Serialize args
    buffer.writeInt32LE(vote, offset);
    offset += 4;

    return buffer.slice(0, offset);
  }

  // Serialize InstantLaunchArgs for the backend
  private serializeInstantLaunchArgs(launchData: any): Buffer {
    const args = {
      name: launchData.name || '',
      symbol: launchData.symbol || '',
      uri: launchData.uri || '',
      icon: launchData.icon || '',
      description: launchData.description || '',
      website: launchData.website || '',
      twitter: launchData.twitter || '',
      telegram: launchData.telegram || '',
      discord: launchData.discord || '',
    };

    // Serialize using Borsh-like format
    const buffer = Buffer.alloc(1024);
    let offset = 0;

    // Add discriminator
    INSTRUCTION_DISCRIMINATORS.CREATE_INSTANT_LAUNCH.copy(buffer, offset);
    offset += INSTRUCTION_DISCRIMINATORS.CREATE_INSTANT_LAUNCH.length;

    // Serialize string fields
    const serializeString = (str: string) => {
      const strBytes = Buffer.from(str, 'utf8');
      buffer.writeUInt32LE(strBytes.length, offset);
      offset += 4;
      strBytes.copy(buffer, offset);
      offset += strBytes.length;
    };

    serializeString(args.name);
    serializeString(args.symbol);
    serializeString(args.uri);
    serializeString(args.icon);
    serializeString(args.description);
    serializeString(args.website);
    serializeString(args.twitter);
    serializeString(args.telegram);
    serializeString(args.discord);

    return buffer.slice(0, offset);
  }

  // Get launch data from blockchain
  async getLaunchData(launchId: string): Promise<any> {
    try {
      const pdas = await this.deriveMainProgramPDAs(launchId, PublicKey.default);
      const accountInfo = await this.connection.getAccountInfo(pdas.launchDataPDA);
      
      if (!accountInfo) {
        return null;
      }

      // Parse the account data based on your program's structure
      // This is a simplified version - you'll need to implement proper deserialization
      return {
        id: launchId,
        name: 'Parsed Launch Name',
        symbol: 'SYM',
        status: 'active',
        totalTicketsSold: 0,
        hypeScore: 0,
        // ... other fields
      };
    } catch (error) {
      console.error('Error fetching launch data:', error);
      return null;
    }
  }

  // Get all launches
  async getAllLaunches(): Promise<any[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(PROGRAM_IDS.MAIN_PROGRAM);
      const launches: any[] = [];

      for (const account of accounts) {
        try {
          // Parse account data - this is simplified
          const launchData = {
            id: 'launch-' + Math.random().toString(36).substr(2, 9),
            name: 'Sample Launch',
            symbol: 'SMP',
            status: 'active',
            totalTicketsSold: Math.floor(Math.random() * 1000),
            hypeScore: Math.floor(Math.random() * 100),
            ticketPrice: 0.1 * LAMPORTS_PER_SOL,
            numMints: 1000,
            launchDate: Date.now() / 1000,
            closeDate: Date.now() / 1000 + 86400,
          };
          launches.push(launchData);
        } catch (error) {
          console.error('Error parsing launch account:', error);
        }
      }

      return launches;
    } catch (error) {
      console.error('Error fetching launches:', error);
      return [];
    }
  }

  // Citizens program integration
  async createMissionTransaction(
    user: PublicKey,
    difficulty: number,
    seed: string
  ): Promise<Transaction> {
    const transaction = new Transaction();
    
    // Derive mission PDA
    const [missionPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('mission'), user.toBuffer(), Buffer.from(seed)],
      PROGRAM_IDS.CITIZENS_PROGRAM
    );

    const instruction = new TransactionInstruction({
      programId: PROGRAM_IDS.CITIZENS_PROGRAM,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: missionPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: this.serializeMissionArgs(difficulty, seed),
    });

    transaction.add(instruction);
    return transaction;
  }

  private serializeMissionArgs(difficulty: number, seed: string): Buffer {
    const buffer = Buffer.alloc(64);
    let offset = 0;

    INSTRUCTION_DISCRIMINATORS.START_MISSION.copy(buffer, offset);
    offset += INSTRUCTION_DISCRIMINATORS.START_MISSION.length;

    buffer.writeUInt32LE(difficulty, offset);
    offset += 4;

    const seedBytes = Buffer.from(seed, 'hex');
    seedBytes.copy(buffer, offset);
    offset += seedBytes.length;

    return buffer.slice(0, offset);
  }

  // Listings program integration
  async createListingTransaction(
    user: PublicKey,
    assetId: string,
    price: number
  ): Promise<Transaction> {
    const transaction = new Transaction();
    
    // Derive listing PDA
    const [listingPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('listing'), user.toBuffer(), Buffer.from(assetId)],
      PROGRAM_IDS.LISTINGS_PROGRAM
    );

    const instruction = new TransactionInstruction({
      programId: PROGRAM_IDS.LISTINGS_PROGRAM,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: listingPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: this.serializeListingArgs(assetId, price),
    });

    transaction.add(instruction);
    return transaction;
  }

  private serializeListingArgs(assetId: string, price: number): Buffer {
    const buffer = Buffer.alloc(128);
    let offset = 0;

    INSTRUCTION_DISCRIMINATORS.CREATE_LISTING.copy(buffer, offset);
    offset += INSTRUCTION_DISCRIMINATORS.CREATE_LISTING.length;

    const assetIdBytes = Buffer.from(assetId, 'utf8');
    buffer.writeUInt32LE(assetIdBytes.length, offset);
    offset += 4;
    assetIdBytes.copy(buffer, offset);
    offset += assetIdBytes.length;

    buffer.writeUInt64LE(price, offset);
    offset += 8;

    return buffer.slice(0, offset);
  }
}

// Singleton instance
let backendIntegration: BackendIntegration | null = null;

export function getBackendIntegration(): BackendIntegration {
  if (!backendIntegration) {
    backendIntegration = new BackendIntegration();
  }
  return backendIntegration;
}

export default BackendIntegration;