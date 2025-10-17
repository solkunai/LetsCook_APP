import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "./lib/wallet";
import CalendarPage from "@/pages/CalendarPage";
import ProfilePage from "@/pages/ProfilePage";
import ReferralsPage from "@/pages/ReferralsPage";
import TradePage from "@/pages/TradePage";
import DocsPage from "@/pages/DocsPage";
import CreateLaunchPage from "@/pages/CreateLaunchPage";
import SimpleCreateLaunchPage from "@/pages/SimpleCreateLaunchPage";
import UltraSimpleTestPage from "@/pages/UltraSimpleTestPage";
import DebugPage from "@/pages/DebugPage";
import CollectionsPage from "@/pages/CollectionsPage";
import CollectionLaunchPage from "@/pages/CollectionLaunchPage";
import InstantLaunchPage from "@/pages/InstantLaunchPage";
import AchievementsPage from "@/pages/AchievementsPage";
import HypeVotingPage from "@/pages/HypeVotingPage";
import TransferHookPage from "@/pages/TransferHookPage";
import UserStatsPage from "@/pages/UserStatsPage";
import HomePage from "@/pages/HomePage";
import TokenDetailPage from "@/pages/TokenDetailPage";
import LiquidityPage from "@/pages/LiquidityPage";
import LaunchesPage from "@/pages/LaunchesPage";
import LaunchDetailPage from "@/pages/LaunchDetailPage";
import RaffleDetailPage from "@/pages/RaffleDetailPage";
import CreateRafflePage from "@/pages/CreateRafflePage";
import TrendingRafflesPage from "@/pages/TrendingRafflesPage";
import TrendingTokensPage from "@/pages/TrendingTokensPage";
import NativeProgramTestPage from "@/pages/NativeProgramTestPage";
import BlockchainDebugPage from "@/pages/BlockchainDebugPage";
import SimpleTestPage from "@/pages/SimpleTestPage";
import OnboardingFlow from "@/components/OnboardingFlow";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/launches" component={LaunchesPage} />
      <Route path="/trending-raffles" component={TrendingRafflesPage} />
      <Route path="/trending-tokens" component={TrendingTokensPage} />
      <Route path="/launch/:id" component={({ params }: { params: { id: string } }) => <LaunchDetailPage launchId={params.id} />} />
      <Route path="/raffle/:id" component={({ params }: { params: { id: string } }) => <RaffleDetailPage raffleId={params.id} />} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/docs" component={DocsPage} />
      <Route path="/create-launch" component={CreateLaunchPage} />
      <Route path="/create-raffle" component={CreateRafflePage} />
      <Route path="/instant-launch" component={InstantLaunchPage} />
      <Route path="/collections" component={CollectionsPage} />
      <Route path="/collections/launch" component={CollectionLaunchPage} />
      <Route path="/achievements" component={AchievementsPage} />
      <Route path="/hype-voting" component={HypeVotingPage} />
      <Route path="/transfer-hooks" component={TransferHookPage} />
      <Route path="/user-stats" component={UserStatsPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/referrals" component={ReferralsPage} />
      <Route path="/trade" component={TradePage} />
      <Route path="/token/:tokenId" component={TokenDetailPage} />
      <Route path="/liquidity" component={LiquidityPage} />
      <Route path="/simple-create" component={SimpleCreateLaunchPage} />
      <Route path="/ultra-test" component={UltraSimpleTestPage} />
      <Route path="/debug" component={DebugPage} />
      <Route path="/blockchain-debug" component={BlockchainDebugPage} />
      <Route path="/simple-test" component={SimpleTestPage} />
      <Route path="/native-test" component={NativeProgramTestPage} />
    </Switch>
  );
}

function AppContent() {
  // todo: remove mock functionality - check for actual user onboarding status
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem("onboarding_complete");
  });

  const handleOnboardingComplete = (data: any) => {
    console.log("Onboarding completed:", data);
    localStorage.setItem("onboarding_complete", "true");
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return (
      <OnboardingFlow onComplete={handleOnboardingComplete} />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main>
        <Router />
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WalletProvider>
          <AppContent />
          <Toaster />
        </WalletProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
