import { Link, useLocation } from 'wouter';
import { 
  ChefHat, 
  Calendar, 
  User, 
  Users, 
  TrendingUp,
  Flame
} from 'lucide-react';

export default function BottomNav() {
  const [location] = useLocation();

  const navigation = [
    { name: 'Home', href: '/', icon: ChefHat },
    { name: 'Calendar', href: '/calendar', icon: Calendar },
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Referrals', href: '/referrals', icon: Users },
    { name: 'Trade', href: '/trade', icon: TrendingUp },
  ];

  return (
    <nav className="nav-bottom">
      <div className="container">
        <div className="flex items-center justify-around">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}