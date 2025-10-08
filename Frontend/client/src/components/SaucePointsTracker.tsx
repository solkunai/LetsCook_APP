import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import SaucePointsBadge, { getSauceLevel } from "./SaucePointsBadge";
import { Flame, Ticket, TrendingUp, Users, Trophy } from "lucide-react";

interface PointActivity {
  action: string;
  points: number;
  icon: any;
}

interface SaucePointsTrackerProps {
  totalPoints: number;
  activities: PointActivity[];
  showLeaderboard?: boolean;
  leaderboardData?: Array<{ rank: number; username: string; points: number }>;
}

const pointsActions = [
  { action: "Username Created", points: 10, icon: Users },
  { action: "Raffle Launched", points: 100, icon: Flame },
  { action: "Ticket Purchased", points: 10, icon: Ticket },
  { action: "Token Trade", points: 20, icon: TrendingUp },
  { action: "Friend Referred", points: 50, icon: Users },
];

export default function SaucePointsTracker({
  totalPoints,
  activities,
  showLeaderboard = false,
  leaderboardData = [],
}: SaucePointsTrackerProps) {
  const currentLevel = getSauceLevel(totalPoints);
  const nextMilestone = totalPoints < 100 ? 100 : totalPoints < 500 ? 500 : totalPoints < 1000 ? 1000 : 2000;
  const progress = totalPoints > 0 ? (totalPoints / nextMilestone) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Current Level Card */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-semibold text-lg">Sauce Points</h3>
            <p className="text-3xl font-heading font-bold text-primary" data-testid="text-total-points">
              {totalPoints}
            </p>
          </div>
          <SaucePointsBadge points={totalPoints} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress to {nextMilestone}</span>
            <span className="font-medium">{isNaN(progress) ? '0' : Math.min(progress, 100).toFixed(0)}%</span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-3" />
        </div>
      </Card>

      {/* Points Breakdown */}
      <Card className="p-6">
        <h4 className="font-heading font-semibold mb-4">Earn Points By</h4>
        <div className="space-y-3">
          {pointsActions.map((activity, index) => {
            const Icon = activity.icon;
            return (
              <div key={index} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium">{activity.action}</span>
                </div>
                <Badge variant="outline" className="text-primary">
                  +{activity.points} pts
                </Badge>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Leaderboard */}
      {showLeaderboard && leaderboardData.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-primary" />
            <h4 className="font-heading font-semibold">Top Earners</h4>
          </div>
          <div className="space-y-2">
            {leaderboardData.map((entry) => (
              <div
                key={entry.rank}
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    entry.rank === 1 ? 'bg-yellow-500 text-white' :
                    entry.rank === 2 ? 'bg-gray-400 text-white' :
                    entry.rank === 3 ? 'bg-orange-600 text-white' :
                    'bg-secondary text-foreground'
                  }`}>
                    {entry.rank}
                  </div>
                  <span className="font-medium" data-testid={`text-leaderboard-username-${entry.rank}`}>
                    {entry.username}
                  </span>
                </div>
                <span className="font-semibold text-primary" data-testid={`text-leaderboard-points-${entry.rank}`}>
                  {entry.points} pts
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
