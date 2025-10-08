import { Link } from 'wouter';
import { Flame } from 'lucide-react';

export default function FloatingActionButton() {
  return (
    <Link href="/create-launch">
      <button className="fab">
        <Flame className="w-6 h-6 text-primary-foreground" />
      </button>
    </Link>
  );
}