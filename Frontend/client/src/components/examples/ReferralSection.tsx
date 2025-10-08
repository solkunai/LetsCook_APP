import ReferralSection from '../ReferralSection';
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

export default function ReferralSectionExample() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="p-4 max-w-lg">
        <ReferralSection
          referralCode="CHEF2025"
          referredCount={12}
          pointsEarned={600}
          referredFriends={[
            { username: "alice_chef", pointsEarned: 50, date: "2025-01-20" },
            { username: "bob_cook", pointsEarned: 50, date: "2025-01-18" },
            { username: "charlie_master", pointsEarned: 50, date: "2025-01-15" },
          ]}
        />
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}
