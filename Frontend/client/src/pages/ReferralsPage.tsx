import { useWalletConnection } from "@/lib/wallet";
import { useAPIServices } from "@/lib/apiServices";
import ReferralSection from "@/components/ReferralSection";
import Header from "@/components/Header";
import { Users } from "lucide-react";
import { useState, useEffect } from "react";

// Referral data will be fetched from blockchain
// const mockReferralData = {
//   referralCode: "CHEF2025",
//   referredCount: 12,
//   pointsEarned: 600,
//   referredFriends: [
//     { username: "alice_chef", pointsEarned: 50, date: "2025-01-20" },
//     { username: "bob_cook", pointsEarned: 50, date: "2025-01-18" },
//     { username: "charlie_master", pointsEarned: 50, date: "2025-01-15" },
//     { username: "diana_spicy", pointsEarned: 50, date: "2025-01-12" },
//   ],
// };

export default function ReferralsPage() {
  const { wallet } = useWalletConnection();
  const apiServices = useAPIServices();
  const [referralData, setReferralData] = useState({
    referralCode: "",
    referredCount: 0,
    pointsEarned: 0,
    referredFriends: [],
  });

  useEffect(() => {
    if (wallet.publicKey) {
      // Fetch real referral data from blockchain
      // This would call the citizens program to get referral data
      // For now, we'll use empty data until the API is implemented
    }
  }, [wallet.publicKey]);

  return (
    <div className="min-h-screen bg-background">
      <Header 
        title="Refer & Earn"
        subtitle="Spread the degen energy 🔥"
        showNavigation={true}
      />

      <div className="max-w-lg mx-auto px-4 py-6 pt-24">
        <ReferralSection {...referralData} />
      </div>
    </div>
  );
}
