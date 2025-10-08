import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

// Listings Program ID (update with actual deployed program ID)
const LISTINGS_PROGRAM_ID = new PublicKey('Listings1111111111111111111111111111111111');

// Listings Program Types
export interface ListingData {
  account_type: number;
  id: number;
  mint: PublicKey;
  name: string;
  symbol: string;
  decimals: number;
  icon_url: string;
  meta_url: string;
  banner_url: string;
  description: string;
  positive_votes: number;
  negative_votes: number;
  socials: string[];
  creator: PublicKey;
  created_at: number;
  updated_at: number;
  status: ListingStatus;
}

export enum ListingStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
  Suspended = 3,
}

export interface UnverifiedListingData {
  account_type: number;
  creator: PublicKey;
  name: string;
  symbol: string;
  icon: string;
  uri: string;
  banner: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  created_at: number;
  votes: number;
  status: number;
}

// Helper functions to derive PDAs
export function getListingPDA(mint: PublicKey, programId: PublicKey = LISTINGS_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [mint.toBuffer(), Buffer.from('listing')],
    programId
  );
}

export function getUnverifiedListingPDA(creator: PublicKey, programId: PublicKey = LISTINGS_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [creator.toBuffer(), Buffer.from('unverified')],
    programId
  );
}

// Listings Program Instructions
export async function createUnverifiedListing(
  connection: Connection,
  walletPublicKey: PublicKey,
  args: {
    name: string;
    symbol: string;
    icon: string;
    uri: string;
    banner: string;
    description: string;
    website: string;
    twitter: string;
    telegram: string;
    discord: string;
  }
): Promise<string> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;
  
  // Derive unverified listing PDA
  const [unverifiedPDA] = getUnverifiedListingPDA(walletPublicKey);
  
  // Create instruction data
  const instructionData = Buffer.alloc(1000);
  let offset = 0;
  
  // Add instruction discriminator (placeholder)
  instructionData.writeUInt32LE(0x11111111, offset);
  offset += 4;
  
  // Serialize string fields
  const fields = [
    args.name,
    args.symbol,
    args.icon,
    args.uri,
    args.banner,
    args.description,
    args.website,
    args.twitter,
    args.telegram,
    args.discord,
  ];
  
  for (const field of fields) {
    const fieldBytes = Buffer.from(field, 'utf8');
    instructionData.writeUInt32LE(fieldBytes.length, offset);
    offset += 4;
    instructionData.set(fieldBytes, offset);
    offset += fieldBytes.length;
  }
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: unverifiedPDA, isSigner: false, isWritable: true },
    ],
    programId: LISTINGS_PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  
  const signature = await connection.sendTransaction(transaction, []);
  await connection.confirmTransaction(signature);
  
  return signature;
}

export async function createListing(
  connection: Connection,
  walletPublicKey: PublicKey,
  mint: PublicKey,
  provider: number = 0
): Promise<string> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;
  
  // Derive listing PDA
  const [listingPDA] = getListingPDA(mint);
  
  // Create instruction data
  const instructionData = Buffer.alloc(100);
  let offset = 0;
  
  // Add instruction discriminator (placeholder)
  instructionData.writeUInt32LE(0x22222222, offset);
  offset += 4;
  
  // Add provider
  instructionData.writeUInt8(provider, offset);
  offset += 1;
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: listingPDA, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
    ],
    programId: LISTINGS_PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  
  const signature = await connection.sendTransaction(transaction, []);
  await connection.confirmTransaction(signature);
  
  return signature;
}

export async function editListing(
  connection: Connection,
  walletPublicKey: PublicKey,
  mint: PublicKey,
  args: {
    description: string;
    website: string;
    twitter: string;
    telegram: string;
    discord: string;
  }
): Promise<string> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;
  
  // Derive listing PDA
  const [listingPDA] = getListingPDA(mint);
  
  // Create instruction data
  const instructionData = Buffer.alloc(1000);
  let offset = 0;
  
  // Add instruction discriminator (placeholder)
  instructionData.writeUInt32LE(0x33333333, offset);
  offset += 4;
  
  // Serialize string fields
  const fields = [
    args.description,
    args.website,
    args.twitter,
    args.telegram,
    args.discord,
  ];
  
  for (const field of fields) {
    const fieldBytes = Buffer.from(field, 'utf8');
    instructionData.writeUInt32LE(fieldBytes.length, offset);
    offset += 4;
    instructionData.set(fieldBytes, offset);
    offset += fieldBytes.length;
  }
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: listingPDA, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
    ],
    programId: LISTINGS_PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  
  const signature = await connection.sendTransaction(transaction, []);
  await connection.confirmTransaction(signature);
  
  return signature;
}

export async function removeListing(
  connection: Connection,
  walletPublicKey: PublicKey,
  mint: PublicKey
): Promise<string> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;
  
  // Derive listing PDA
  const [listingPDA] = getListingPDA(mint);
  
  // Create instruction data
  const instructionData = Buffer.alloc(100);
  let offset = 0;
  
  // Add instruction discriminator (placeholder)
  instructionData.writeUInt32LE(0x44444444, offset);
  offset += 4;
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: listingPDA, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
    ],
    programId: LISTINGS_PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  
  const signature = await connection.sendTransaction(transaction, []);
  await connection.confirmTransaction(signature);
  
  return signature;
}

// Data fetching functions
export async function fetchListingData(
  connection: Connection,
  mint: PublicKey
): Promise<ListingData | null> {
  try {
    const [listingPDA] = getListingPDA(mint);
    const accountInfo = await connection.getAccountInfo(listingPDA);
    
    if (!accountInfo) return null;
    
    // Parse listing data from account
    // This is a placeholder - implement proper deserialization
    return null;
  } catch (error) {
    console.error('Error fetching listing data:', error);
    return null;
  }
}

export async function fetchAllListings(
  connection: Connection
): Promise<ListingData[]> {
  try {
    const programAccounts = await connection.getProgramAccounts(LISTINGS_PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: Buffer.from([0]).toString('base64'), // Listing account type
          },
        },
      ],
    });

    const listings: ListingData[] = [];
    
    for (const { account } of programAccounts) {
      try {
        // Parse listing data from account
        // This is a placeholder - implement proper deserialization
      } catch (error) {
        console.error('Error parsing listing data:', error);
      }
    }
    
    return listings;
  } catch (error) {
    console.error('Error fetching listings:', error);
    return [];
  }
}

export async function fetchUnverifiedListings(
  connection: Connection
): Promise<UnverifiedListingData[]> {
  try {
    const programAccounts = await connection.getProgramAccounts(LISTINGS_PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: Buffer.from([1]).toString('base64'), // Unverified listing account type
          },
        },
      ],
    });

    const unverifiedListings: UnverifiedListingData[] = [];
    
    for (const { account } of programAccounts) {
      try {
        // Parse unverified listing data from account
        // This is a placeholder - implement proper deserialization
      } catch (error) {
        console.error('Error parsing unverified listing data:', error);
      }
    }
    
    return unverifiedListings;
  } catch (error) {
    console.error('Error fetching unverified listings:', error);
    return [];
  }
}

export async function fetchListingsByCreator(
  connection: Connection,
  creator: PublicKey
): Promise<ListingData[]> {
  try {
    const programAccounts = await connection.getProgramAccounts(LISTINGS_PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: Buffer.from([0]).toString('base64'), // Listing account type
          },
        },
        {
          memcmp: {
            offset: 1, // Creator is at offset 1
            bytes: creator.toBase58(),
          },
        },
      ],
    });

    const listings: ListingData[] = [];
    
    for (const { account } of programAccounts) {
      try {
        // Parse listing data from account
        // This is a placeholder - implement proper deserialization
      } catch (error) {
        console.error('Error parsing listing data:', error);
      }
    }
    
    return listings;
  } catch (error) {
    console.error('Error fetching listings by creator:', error);
    return [];
  }
}

// Utility functions
export function calculateListingScore(positiveVotes: number, negativeVotes: number): number {
  const totalVotes = positiveVotes + negativeVotes;
  if (totalVotes === 0) return 0;
  return (positiveVotes / totalVotes) * 100;
}

export function isListingApproved(listing: ListingData): boolean {
  return listing.status === ListingStatus.Approved;
}

export function getListingStatusText(status: ListingStatus): string {
  switch (status) {
    case ListingStatus.Pending:
      return 'Pending Review';
    case ListingStatus.Approved:
      return 'Approved';
    case ListingStatus.Rejected:
      return 'Rejected';
    case ListingStatus.Suspended:
      return 'Suspended';
    default:
      return 'Unknown';
  }
}

export function getListingStatusColor(status: ListingStatus): string {
  switch (status) {
    case ListingStatus.Pending:
      return 'bg-yellow-100 text-yellow-800';
    case ListingStatus.Approved:
      return 'bg-green-100 text-green-800';
    case ListingStatus.Rejected:
      return 'bg-red-100 text-red-800';
    case ListingStatus.Suspended:
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Export constants
export { LISTINGS_PROGRAM_ID };
