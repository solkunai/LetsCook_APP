import React from 'react';
import { useLocation } from 'wouter';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  X,
  Home,
  Plus,
  TrendingUp,
  Users,
  DollarSign,
  BarChart3,
  ChevronDown,
  Ticket,
  Flame,
  Zap
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

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
  const [isScrolled, setIsScrolled] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigationItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Create Launch', href: '/create-launch', icon: Plus },
    { name: 'Live Launches', href: '/#launches', icon: TrendingUp },
    { name: 'Liquidity', href: '/liquidity', icon: DollarSign },
    { name: 'Referrals', href: '/referrals', icon: Users },
    { name: 'Trade', href: '/trade', icon: BarChart3 },
  ];

  // Degen mode dropdown items
  const [isDegenMenuOpen, setIsDegenMenuOpen] = useState(false);
  const degenMenuRef = useRef<HTMLDivElement>(null);

  const degenMenuItems = [
    { name: 'View Active Raffles', href: '/#launches', icon: Ticket, description: 'See all active raffles' },
    { name: 'Trending Raffles', href: '/trending-raffles', icon: Flame, description: 'Hottest raffles right now' },
    { name: 'Trending Tokens', href: '/trending-tokens', icon: Zap, description: 'Top performing tokens' },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (degenMenuRef.current && !degenMenuRef.current.contains(event.target as Node)) {
        setIsDegenMenuOpen(false);
      }
    };

    if (isDegenMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDegenMenuOpen]);

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
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-background/95 backdrop-blur-lg border-b border-border/50 shadow-lg' 
        : 'bg-background/80 backdrop-blur-md border-b border-border/50'
    }`}>
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img 
                src="/logo.png" 
                alt="Let's Cook Logo" 
                className="w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 object-contain"
              />
              <div className="absolute -top-1 -right-1 w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 bg-clip-text text-transparent">
                {title}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">{subtitle}</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          {showNavigation && (
            <>
              <nav className="hidden lg:flex items-center space-x-6">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavClick(item.href)}
                      className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden xl:inline">{item.name}</span>
                    </button>
                  );
                })}
                
                {/* Degen Mode Dropdown */}
                <div className="relative" ref={degenMenuRef}>
                  <button
                    onClick={() => setIsDegenMenuOpen(!isDegenMenuOpen)}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    <Flame className="w-4 h-4 text-yellow-400 group-hover:animate-pulse" />
                    <span className="hidden xl:inline bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent font-bold">
                      DEGEN
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isDegenMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <AnimatePresence>
                    {isDegenMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-lg border border-yellow-500/20 rounded-xl shadow-2xl overflow-hidden z-50"
                      >
                        <div className="p-2">
                          {degenMenuItems.map((item) => {
                            const Icon = item.icon;
                            return (
                              <button
                                key={item.name}
                                onClick={() => {
                                  handleNavClick(item.href);
                                  setIsDegenMenuOpen(false);
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-yellow-500/10 transition-colors group"
                              >
                                <div className="p-2 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
                                  <Icon className="w-4 h-4 text-yellow-400" />
                                </div>
                                <div className="flex-1 text-left">
                                  <div className="text-sm font-semibold text-white group-hover:text-yellow-400 transition-colors">
                                    {item.name}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    {item.description}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </nav>

              {/* Desktop Wallet Button */}
              <div className="hidden lg:block">
                <WalletMultiButton className="wallet-adapter-button-custom" />
              </div>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </>
          )}
        </div>

        {/* Mobile Navigation */}
        {showNavigation && isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-border/50 mt-3 pt-4"
          >
            <div className="space-y-3">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavClick(item.href)}
                    className="flex items-center gap-3 w-full text-left p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </button>
                );
              })}
              
              {/* Degen Mode in Mobile */}
              <div className="pt-3 border-t border-border/50">
                <div className="mb-2 px-3 py-2 text-xs font-semibold text-yellow-400 flex items-center gap-2">
                  <Flame className="w-4 h-4" />
                  DEGEN MODE
                </div>
                {degenMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        handleNavClick(item.href);
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-3 w-full text-left p-3 rounded-lg hover:bg-yellow-500/10 transition-colors"
                    >
                      <Icon className="w-5 h-5 text-yellow-400" />
                      <div>
                        <div className="font-medium text-white">{item.name}</div>
                        <div className="text-xs text-slate-400">{item.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              <div className="pt-3 border-t border-border/50">
                <WalletMultiButton className="wallet-adapter-button-custom w-full" />
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </header>
  );
}