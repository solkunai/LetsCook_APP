import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  TrendingUp, 
  Shield, 
  Users, 
  DollarSign,
  CheckCircle,
  Info
} from 'lucide-react';

export interface DEXOption {
  id: 'raydium' | 'cook';
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  features: string[];
  fees: string;
  liquidity: string;
  trustScore: number;
  recommended?: boolean;
}

const dexOptions: DEXOption[] = [
  {
    id: 'cook',
    name: 'Cook DEX',
    description: 'Our native DEX with integrated launchpad features',
    icon: Zap,
    features: [
      'Integrated with Let\'s Cook launchpad',
      'Lower fees for Cook ecosystem tokens',
      'Built-in market making rewards',
      'Native token support',
      'Community governance'
    ],
    fees: '0.25%',
    liquidity: 'Growing',
    trustScore: 95,
    recommended: true
  },
  {
    id: 'raydium',
    name: 'Raydium',
    description: 'Established DEX with high liquidity',
    icon: TrendingUp,
    features: [
      'High liquidity pools',
      'Established ecosystem',
      'Advanced trading features',
      'Cross-platform compatibility',
      'Proven track record'
    ],
    fees: '0.30%',
    liquidity: 'High',
    trustScore: 98
  }
];

interface DEXSelectorProps {
  selectedDEX: string;
  onSelectDEX: (dexId: string) => void;
  disabled?: boolean;
}

export default function DEXSelector({ selectedDEX, onSelectDEX, disabled = false }: DEXSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">Choose Your DEX</h3>
        <p className="text-muted-foreground">
          Select which DEX to use for liquidity pool creation
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dexOptions.map((dex) => {
          const Icon = dex.icon;
          const isSelected = selectedDEX === dex.id;
          
          return (
            <Card 
              key={dex.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                isSelected 
                  ? 'ring-2 ring-primary border-primary bg-primary/5' 
                  : 'hover:border-primary/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !disabled && onSelectDEX(dex.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      dex.id === 'cook' 
                        ? 'bg-gradient-to-r from-primary to-yellow-400' 
                        : 'bg-gradient-to-r from-blue-500 to-blue-600'
                    }`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {dex.name}
                        {dex.recommended && (
                          <Badge variant="default" className="text-xs">
                            Recommended
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{dex.description}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle className="w-6 h-6 text-primary" />
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Features */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Key Features:</h4>
                  <ul className="space-y-1">
                    {dex.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1 h-1 bg-primary rounded-full flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-primary">{dex.fees}</div>
                    <div className="text-xs text-muted-foreground">Trading Fee</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-primary">{dex.liquidity}</div>
                    <div className="text-xs text-muted-foreground">Liquidity</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-primary">{dex.trustScore}%</div>
                    <div className="text-xs text-muted-foreground">Trust Score</div>
                  </div>
                </div>

                {/* Action Button */}
                <Button 
                  className="w-full" 
                  variant={isSelected ? "default" : "outline"}
                  disabled={disabled}
                >
                  {isSelected ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Selected
                    </>
                  ) : (
                    <>
                      <Icon className="w-4 h-4 mr-2" />
                      Select {dex.name}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 mb-1">DEX Selection Impact</p>
              <p className="text-blue-700">
                Your choice affects trading fees, liquidity depth, and available features. 
                Cook DEX offers integrated rewards and lower fees for ecosystem tokens, 
                while Raydium provides established liquidity and broader compatibility.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}