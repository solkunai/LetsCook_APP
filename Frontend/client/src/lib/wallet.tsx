import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter, TorusWalletAdapter, LedgerWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

// Network configuration
const network = WalletAdapterNetwork.Devnet;

// Use Helius RPC - HARDCODED API KEY FOR TESTING
const HELIUS_API_KEY = '90f9fe0f-400f-4368-bc82-26d2a91b1da6'; // Hardcoded for testing
const HELIUS_NETWORK = 'devnet';

const getRpcEndpoint = () => {
  return `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`;
};

// Custom hook for wallet functionality
export function useWalletConnection() {
  const { publicKey, connected, connecting, connect, disconnect, wallet } = useWallet();
  
  return {
    publicKey,
    connected,
    connecting,
    connect,
    disconnect,
    wallet,
  };
}

// Wallet provider component
export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Configure wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    [network]
  );

  // Configure connection - use Helius RPC if available
  const endpoint = useMemo(() => getRpcEndpoint(), []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}