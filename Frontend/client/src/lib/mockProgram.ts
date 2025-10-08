import { PublicKey } from '@solana/web3.js';

// Mock program service for testing when real program is not available
export class MockProgramService {
  private connection: any;

  constructor(connection: any) {
    this.connection = connection;
  }

  // Mock simple launch creation that always succeeds
  async createSimpleLaunch(
    wallet: any,
    launchData: {
      name: string;
      symbol: string;
      description: string;
      totalSupply: number;
      decimals: number;
    }
  ): Promise<string> {
    try {
      console.log('🎭 MockProgram: Creating mock launch with data:', launchData);
      console.log('🎭 MockProgram: Wallet object:', wallet);
      console.log('🎭 MockProgram: Wallet publicKey:', wallet?.publicKey);

      // Validate wallet and publicKey
      if (!wallet) {
        throw new Error('Wallet is not provided');
      }
      
      if (!wallet.publicKey) {
        throw new Error('Wallet publicKey is not available. Please connect your wallet.');
      }

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate a mock transaction signature
      const mockSignature = this.generateMockSignature();
      
      console.log('✅ MockProgram: Mock launch created successfully!', mockSignature);
      return mockSignature;
    } catch (error) {
      console.error('❌ MockProgram: Error creating mock launch:', error);
      throw error;
    }
  }

  // Mock ultra simple test that always succeeds
  async testUltraSimple(
    wallet: any
  ): Promise<string> {
    try {
      console.log('🎭 MockProgram: Running ultra simple test...');
      console.log('🎭 MockProgram: Wallet object:', wallet);

      // Validate wallet
      if (!wallet) {
        throw new Error('Wallet is not provided');
      }
      
      if (!wallet.publicKey) {
        throw new Error('Wallet publicKey is not available. Please connect your wallet.');
      }

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate a mock transaction signature
      const mockSignature = this.generateMockSignature();
      
      console.log('✅ MockProgram: Ultra simple test completed!', mockSignature);
      return mockSignature;
    } catch (error) {
      console.error('❌ MockProgram: Error in ultra simple test:', error);
      throw error;
    }
  }

  // Test program connection (always returns true for mock)
  async testProgramConnection(): Promise<boolean> {
    try {
      console.log('🎭 MockProgram: Testing mock connection...');
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✅ MockProgram: Mock connection successful!');
      return true;
    } catch (error) {
      console.error('❌ MockProgram: Error testing mock connection:', error);
      throw error;
    }
  }

  // Request airdrop (mock - always succeeds)
  async requestAirdrop(wallet: any): Promise<void> {
    if (!wallet?.publicKey) {
      throw new Error('Wallet not connected for airdrop');
    }
    console.log(`🎭 MockProgram: Mock airdrop for ${wallet.publicKey.toBase58()}...`);
    // Simulate airdrop processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ MockProgram: Mock airdrop completed!');
  }

  // Generate a mock transaction signature
  private generateMockSignature(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 88; i++) { // Solana signatures are 88 characters
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export const mockProgramService = new MockProgramService(null);