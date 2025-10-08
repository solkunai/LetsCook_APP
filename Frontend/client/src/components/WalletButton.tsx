import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton, WalletDisconnectButton as WalletDisconnectButtonUI } from '@solana/wallet-adapter-react-ui';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export function WalletButton() {
  const { connected, publicKey } = useWallet();

  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="px-3 py-1">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
        </Badge>
        <WalletDisconnectButtonUI className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground !rounded-md !px-3 !py-1.5 !text-sm !font-medium !transition-all !duration-200" />
      </div>
    );
  }

  return (
    <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !text-primary-foreground !rounded-md !px-4 !py-2 !font-medium !transition-all !duration-200 !shadow-sm hover:!shadow-md" />
  );
}

export function WalletConnectButton() {
  return <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !text-primary-foreground !rounded-md !px-4 !py-2 !font-medium !transition-all !duration-200 !shadow-sm hover:!shadow-md" />;
}

export function WalletDisconnectButton() {
  return <WalletDisconnectButtonUI className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground !rounded-md !px-3 !py-1.5 !text-sm !font-medium !transition-all !duration-200" />;
}
