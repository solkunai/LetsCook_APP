import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  AccountMeta,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
  Keypair,
  sendAndConfirmTransaction,
  TransactionSignature
} from '@solana/web3.js';
import { useQuery } from '@tanstack/react-query';
import { getHeliusAPI } from './helius';
import { PROGRAM_IDS, INSTRUCTION_DISCRIMINATORS } from './apiServices';

// Transaction types
export interface TransactionResult {
  signature: string;
  success: boolean;
  error?: string;
  slot?: number;
}

export interface TransactionStatus {
  signature: string;
  status: 'pending' | 'confirmed' | 'failed';
  error?: string;
  slot?: number;
}

// Transaction service class
export class TransactionService {
  private connection: Connection;
  private helius: any;

  constructor() {
    this.helius = getHeliusAPI();
    this.connection = this.helius.getConnection();
  }

  // Create a new transaction with proper setup
  async createTransaction(
    instructions: TransactionInstruction[],
    payer: PublicKey,
    priorityFee?: number
  ): Promise<Transaction> {
    const transaction = new Transaction();
    
    // Add instructions
    instructions.forEach(instruction => {
      transaction.add(instruction);
    });

    // Set recent blockhash
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer;

    // Add priority fee if specified
    if (priorityFee && priorityFee > 0) {
      const priorityFeeInstruction = SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: payer, // Transfer to self for priority fee
        lamports: priorityFee,
      });
      transaction.add(priorityFeeInstruction);
    }

    return transaction;
  }

  // Send and confirm transaction
  async sendTransaction(
    transaction: Transaction,
    signers: Keypair[] = []
  ): Promise<TransactionResult> {
    try {
      const signature = await this.connection.sendTransaction(transaction, signers);
      
      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash: transaction.recentBlockhash!,
        lastValidBlockHeight: (await this.connection.getLatestBlockhash()).lastValidBlockHeight,
      });

      if (confirmation.value.err) {
        return {
          signature,
          success: false,
          error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
          slot: confirmation.value.slot,
        };
      }

      return {
        signature,
        success: true,
        slot: confirmation.value.slot,
      };
    } catch (error) {
      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Send transaction with wallet signing
  async sendTransactionWithWallet(
    transaction: Transaction,
    wallet: any
  ): Promise<TransactionResult> {
    try {
      if (!wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      if (!wallet.signTransaction) {
        throw new Error('Wallet does not support signing transactions');
      }

      // Sign transaction
      const signedTransaction = await wallet.signTransaction(transaction);
      
      // Send transaction
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash: transaction.recentBlockhash!,
        lastValidBlockHeight: (await this.connection.getLatestBlockhash()).lastValidBlockHeight,
      });

      if (confirmation.value.err) {
        return {
          signature,
          success: false,
          error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
          slot: confirmation.value.slot,
        };
      }

      return {
        signature,
        success: true,
        slot: confirmation.value.slot,
      };
    } catch (error) {
      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Get transaction status
  async getTransactionStatus(signature: string): Promise<TransactionStatus> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction) {
        return {
          signature,
          status: 'failed',
          error: 'Transaction not found',
        };
      }

      if (transaction.meta?.err) {
        return {
          signature,
          status: 'failed',
          error: `Transaction failed: ${JSON.stringify(transaction.meta.err)}`,
          slot: transaction.slot,
        };
      }

      return {
        signature,
        status: 'confirmed',
        slot: transaction.slot,
      };
    } catch (error) {
      return {
        signature,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Estimate priority fee
  async estimatePriorityFee(accounts: PublicKey[]): Promise<number> {
    try {
      const response = await this.helius.getPriorityFeeEstimate(
        accounts.map(acc => acc.toString()),
        {
          priorityLevel: 'high',
        }
      );

      return response.result?.priorityFeeEstimate || 0;
    } catch (error) {
      console.warn('Failed to estimate priority fee:', error);
      return 0;
    }
  }

  // Create account instruction
  async createAccountInstruction(
    payer: PublicKey,
    newAccount: PublicKey,
    space: number,
    programId: PublicKey
  ): Promise<TransactionInstruction> {
    const lamports = await this.connection.getMinimumBalanceForRentExemption(space);
    return SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: newAccount,
      lamports,
      space,
      programId,
    });
  }

  // Transfer SOL instruction
  createTransferInstruction(
    from: PublicKey,
    to: PublicKey,
    lamports: number
  ): TransactionInstruction {
    return SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports,
    });
  }
}

// React hook for transaction service
export function useTransactionService() {
  return new TransactionService();
}

// Transaction status hook
export function useTransactionStatus(signature: string | null) {
  const transactionService = useTransactionService();
  
  return useQuery({
    queryKey: ['transactionStatus', signature],
    queryFn: () => {
      if (!signature) return null;
      return transactionService.getTransactionStatus(signature);
    },
    enabled: !!signature,
    refetchInterval: 2000, // Check every 2 seconds
    refetchIntervalInBackground: true,
  });
}

// Utility functions for creating program instructions
export function createLaunchInstruction(
  payer: PublicKey,
  launchData: any
): TransactionInstruction {
  // Serialize CreateArgs according to the backend structure
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

  // Serialize the args using Borsh
  const argsBuffer = Buffer.alloc(1024);
  let offset = 0;
  
  // Serialize string fields
  const nameBytes = Buffer.from(args.name, 'utf8');
  argsBuffer.writeUInt32LE(nameBytes.length, offset);
  offset += 4;
  nameBytes.copy(argsBuffer, offset);
  offset += nameBytes.length;
  
  const symbolBytes = Buffer.from(args.symbol, 'utf8');
  argsBuffer.writeUInt32LE(symbolBytes.length, offset);
  offset += 4;
  symbolBytes.copy(argsBuffer, offset);
  offset += symbolBytes.length;
  
  const uriBytes = Buffer.from(args.uri, 'utf8');
  argsBuffer.writeUInt32LE(uriBytes.length, offset);
  offset += 4;
  uriBytes.copy(argsBuffer, offset);
  offset += uriBytes.length;
  
  const iconBytes = Buffer.from(args.icon, 'utf8');
  argsBuffer.writeUInt32LE(iconBytes.length, offset);
  offset += 4;
  iconBytes.copy(argsBuffer, offset);
  offset += iconBytes.length;
  
  const bannerBytes = Buffer.from(args.banner, 'utf8');
  argsBuffer.writeUInt32LE(bannerBytes.length, offset);
  offset += 4;
  bannerBytes.copy(argsBuffer, offset);
  offset += bannerBytes.length;
  
  const pageNameBytes = Buffer.from(args.page_name, 'utf8');
  argsBuffer.writeUInt32LE(pageNameBytes.length, offset);
  offset += 4;
  pageNameBytes.copy(argsBuffer, offset);
  offset += pageNameBytes.length;
  
  // Serialize numeric fields
  argsBuffer.writeUInt64LE(args.total_supply, offset);
  offset += 8;
  argsBuffer.writeUInt8(args.decimals, offset);
  offset += 1;
  argsBuffer.writeUInt64LE(args.launch_date, offset);
  offset += 8;
  argsBuffer.writeUInt64LE(args.close_date, offset);
  offset += 8;
  argsBuffer.writeUInt32LE(args.num_mints, offset);
  offset += 4;
  argsBuffer.writeUInt64LE(args.ticket_price, offset);
  offset += 8;
  argsBuffer.writeUInt16LE(args.transfer_fee, offset);
  offset += 2;
  argsBuffer.writeUInt64LE(args.max_transfer_fee, offset);
  offset += 8;
  argsBuffer.writeUInt8(args.extensions, offset);
  offset += 1;
  argsBuffer.writeUInt8(args.amm_provider, offset);
  offset += 1;
  argsBuffer.writeUInt8(args.launch_type, offset);
  offset += 1;
  argsBuffer.writeUInt64LE(args.whitelist_tokens, offset);
  offset += 8;
  argsBuffer.writeUInt64LE(args.whitelist_end, offset);
  offset += 8;
  
  // Create the instruction data with discriminator
  const data = Buffer.concat([
    INSTRUCTION_DISCRIMINATORS.CREATE_LAUNCH,
    argsBuffer.slice(0, offset)
  ]);
  
  return new TransactionInstruction({
    programId: PROGRAM_IDS.MAIN_PROGRAM,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      // Note: You'll need to add the actual account keys based on your program's requirements
      // This is a simplified version - the real implementation needs all the accounts
    ],
    data,
  });
}

export function createBuyTicketsInstruction(
  payer: PublicKey,
  launchId: string,
  numTickets: number
): TransactionInstruction {
  // Serialize JoinArgs according to the backend structure
  const args = {
    num_tickets: numTickets,
  };

  // Serialize the args
  const argsBuffer = Buffer.alloc(64);
  let offset = 0;
  
  argsBuffer.writeUInt32LE(args.num_tickets, offset);
  offset += 4;
  
  // Create the instruction data with discriminator
  const data = Buffer.concat([
    INSTRUCTION_DISCRIMINATORS.BUY_TICKETS,
    argsBuffer.slice(0, offset)
  ]);
  
  return new TransactionInstruction({
    programId: PROGRAM_IDS.MAIN_PROGRAM,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      // Note: You'll need to add the actual account keys based on your program's requirements
      // This is a simplified version - the real implementation needs all the accounts
    ],
    data,
  });
}

export function createHypeVoteInstruction(
  payer: PublicKey,
  launchId: string,
  vote: number
): TransactionInstruction {
  // Serialize VoteArgs according to the backend structure
  const args = {
    vote: vote,
  };

  // Serialize the args
  const argsBuffer = Buffer.alloc(64);
  let offset = 0;
  
  argsBuffer.writeInt32LE(args.vote, offset);
  offset += 4;
  
  // Create the instruction data with discriminator
  const data = Buffer.concat([
    INSTRUCTION_DISCRIMINATORS.HYPE_VOTE,
    argsBuffer.slice(0, offset)
  ]);
  
  return new TransactionInstruction({
    programId: PROGRAM_IDS.MAIN_PROGRAM,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      // Note: You'll need to add the actual account keys based on your program's requirements
      // This is a simplified version - the real implementation needs all the accounts
    ],
    data,
  });
}

export default TransactionService;