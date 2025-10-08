import React from 'react';
import { useLocation } from 'wouter';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { 
  Menu, 
  X,
  Home,
  Plus,
  TrendingUp,
  Users,
  DollarSign,
  BarChart3
} from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showNavigation?: boolean;
}

export default function Header({ 
  title = "Let's Cook", 
  subtitle = "Solana Launchpad",
  showNavigation = true 
}: HeaderProps) {
  const [, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigationItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Create Launch', href: '/create-launch', icon: Plus },
    { name: 'Live Launches', href: '/#launches', icon: TrendingUp },
    { name: 'Liquidity', href: '/liquidity', icon: DollarSign },
    { name: 'Referrals', href: '/referrals', icon: Users },
    { name: 'Trade', href: '/trade', icon: BarChart3 },
  ];

  const handleNavClick = (href: string) => {
    if (href.startsWith('/#')) {
      // Handle anchor links
      const element = document.querySelector(href.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      setLocation(href);
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img 
                src="/logo.jpg" 
                alt="Let's Cook Logo" 
                className="w-10 h-10 object-contain"
              />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {title}
              </h1>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          {showNavigation && (
            <>
              <nav className="hidden md:flex items-center space-x-6">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavClick(item.href)}
                      className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      {item.name}
                    </button>
                  );
                })}
              </nav>

              {/* Wallet Button */}
              <div className="hidden md:block">
                <WalletMultiButton className="wallet-adapter-button-custom" />
              </div>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </>
          )}

          {/* Mobile Navigation */}
          {showNavigation && isMobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 bg-background border-b border-border/50 md:hidden">
              <div className="container mx-auto px-4 py-4 space-y-4">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavClick(item.href)}
                      className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </button>
                  );
                })}
                <div className="pt-4 border-t border-border/50">
                  <WalletMultiButton className="wallet-adapter-button-custom w-full" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}