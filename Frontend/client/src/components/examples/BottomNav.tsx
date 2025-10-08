import BottomNav from '../BottomNav';
import { Route, Switch } from 'wouter';

export default function BottomNavExample() {
  return (
    <div className="h-screen flex flex-col">
      <Switch>
        <Route path="/" component={() => <div className="flex-1 flex items-center justify-center">Home</div>} />
        <Route path="/calendar" component={() => <div className="flex-1 flex items-center justify-center">Calendar</div>} />
        <Route path="/profile" component={() => <div className="flex-1 flex items-center justify-center">Profile</div>} />
        <Route path="/referrals" component={() => <div className="flex-1 flex items-center justify-center">Referrals</div>} />
        <Route path="/trade" component={() => <div className="flex-1 flex items-center justify-center">Trade</div>} />
      </Switch>
      <BottomNav />
    </div>
  );
}
