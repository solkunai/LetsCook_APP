import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Copy, 
  CheckCircle, 
  ExternalLink, 
  Wallet, 
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { TokenVisibilityHelper, TokenMetadata } from '@/lib/tokenVisibilityHelper';

interface TokenVisibilityCardProps {
  tokenMint: string;
  metadata: TokenMetadata;
  isVisible?: boolean;
}

export default function TokenVisibilityCard({ 
  tokenMint, 
  metadata, 
  isVisible = false 
}: TokenVisibilityCardProps) {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const copyTokenAddress = async () => {
    try {
      await navigator.clipboard.writeText(tokenMint);
      setCopiedAddress(true);
      toast({
        title: "Copied!",
        description: "Token address copied to clipboard.",
      });
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy token address.",
        variant: "destructive",
      });
    }
  };

  const phantomInstructions = TokenVisibilityHelper.getPhantomWalletInstructions(
    new PublicKey(tokenMint),
    metadata
  );

  return (
    <Card className="border-yellow-500/20 bg-yellow-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="w-5 h-5 text-yellow-400" />
            Token Visibility
            {isVisible ? (
              <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                <CheckCircle className="w-3 h-3 mr-1" />
                Visible
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                <Info className="w-3 h-3 mr-1" />
                Manual Add Required
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-yellow-400 hover:text-yellow-300"
          >
            {showInstructions ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Token Info */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Name:</span>
              <p className="font-medium">{metadata.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Symbol:</span>
              <p className="font-medium">{metadata.symbol}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Decimals:</span>
              <p className="font-medium">{metadata.decimals}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Contract:</span>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-slate-700 px-2 py-1 rounded">
                  {tokenMint.slice(0, 8)}...{tokenMint.slice(-8)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyTokenAddress}
                  className="p-1 h-auto"
                >
                  {copiedAddress ? (
                    <CheckCircle className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        {showInstructions && (
          <div className="space-y-3">
            <h4 className="font-semibold text-yellow-400">{phantomInstructions.title}</h4>
            <ol className="space-y-2 text-sm">
              {phantomInstructions.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="bg-yellow-500/20 text-yellow-400 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>

            {/* Quick Add Button */}
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                onClick={() => {
                  // This would open Phantom wallet with pre-filled token info
                  const phantomUrl = `https://phantom.app/ul/browse/${tokenMint}`;
                  window.open(phantomUrl, '_blank');
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Phantom Wallet
              </Button>
            </div>
          </div>
        )}

        {/* Status Message */}
        <div className="text-xs text-muted-foreground bg-slate-800/30 rounded p-3">
          {isVisible ? (
            <p className="text-green-400">
              ✅ Your token is automatically visible in Phantom wallet. Users can find it in their token list.
            </p>
          ) : (
            <p>
              ℹ️ Your token may not appear automatically in Phantom wallet. Users can manually add it using the instructions above or by copying the contract address.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
