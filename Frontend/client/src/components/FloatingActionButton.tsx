import { Link } from 'wouter';
import { Flame } from 'lucide-react';

export default function FloatingActionButton() {
  return (
    <Link href="/create-raffle">
      <button className="group fixed bottom-6 right-6 z-50 w-16 h-16 bg-gradient-to-r from-yellow-500 via-yellow-600 to-yellow-700 hover:from-yellow-400 hover:via-yellow-500 hover:to-yellow-600 rounded-full shadow-2xl hover:shadow-yellow-500/30 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 border-2 border-yellow-400 hover:border-yellow-300 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
        <div className="relative z-10 flex items-center justify-center">
          <Flame className="w-6 h-6 text-white transition-transform group-hover:scale-110" />
        </div>
      </button>
    </Link>
  );
}