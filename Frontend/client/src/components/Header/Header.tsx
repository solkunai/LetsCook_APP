import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Browse Raffles', href: '/raffles' },
  { name: 'Launch Token', href: '/launch' },
  { name: 'My Tickets', href: '/tickets' },
  { name: 'Calendar', href: '/calendar' },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { connected } = useWallet();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        'glass backdrop-blur border-b border-white/5',
        isScrolled
          ? 'py-4 bg-background/80 shadow-lg'
          : 'py-6 bg-transparent'
      )}
    >
      <nav className="container px-4 md:px-6 mx-auto">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 hover-lift">
            <span className="sr-only">Let's Cook</span>
            <span className="relative flex h-10 w-10">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-20"></span>
              <img
                src="/logo.svg"
                alt="Let's Cook Logo"
                className="relative h-10 w-10"
              />
            </span>
            <span className="text-xl font-bold text-gradient hidden sm:inline-block">
              Let's Cook
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.name}
              </NavLink>
            ))}
          </div>

          {/* Wallet & Mobile Menu */}
          <div className="flex items-center space-x-4">
            {connected && (
              <span className="hidden md:flex items-center text-sm text-success">
                <span className="h-2 w-2 rounded-full bg-success mr-2" />
                Connected
              </span>
            )}
            
            <WalletMultiButton className="wallet-adapter-button-custom" />

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <span className="sr-only">Toggle menu</span>
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden"
            >
              <div className="pt-4 pb-3 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'block px-3 py-2 rounded-md text-base font-medium transition-colors',
                      location.pathname === item.href
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-primary/5 hover:text-primary'
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}

import { NavLinkProps } from '@/types/components';

function NavLink({ href, children }: NavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === href;

  return (
    <Link
      to={href}
      className={cn(
        'px-3 py-2 rounded-md text-sm font-medium transition-colors relative group',
        isActive
          ? 'text-primary'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
    </Link>
  );
}