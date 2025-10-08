import SaucePointsTracker from '../SaucePointsTracker';

export default function SaucePointsTrackerExample() {
  return (
    <div className="p-4 max-w-lg">
      <SaucePointsTracker
        totalPoints={350}
        activities={[]}
        showLeaderboard={true}
        leaderboardData={[
          { rank: 1, username: "master_chef", points: 2500 },
          { rank: 2, username: "hot_cook", points: 1800 },
          { rank: 3, username: "spicy_trader", points: 1200 },
          { rank: 4, username: "chef_alice", points: 950 },
          { rank: 5, username: "cook_bob", points: 750 },
        ]}
      />
    </div>
  );
}
