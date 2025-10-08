import React from 'react';
import { useWalletConnection } from '@/lib/wallet';
import { WalletButton } from '@/components/WalletButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function WalletStatus() {
  const { publicKey, connected, connecting } = useWalletConnection();

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Wallet Status
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Connected" : "Disconnected"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <WalletButton />
        
        {connected && publicKey && (
          <div className="space-y-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Public Key:</label>
              <p className="text-sm font-mono break-all">
                {publicKey.toString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Short Address:</label>
              <p className="text-sm font-mono">
                {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
              </p>
            </div>
          </div>
        )}
        
        {connecting && (
          <div className="text-center text-sm text-muted-foreground">
            Connecting wallet...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
