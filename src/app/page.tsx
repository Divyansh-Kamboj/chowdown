'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Star, MapPin } from 'lucide-react';

type Restaurant = {
  id?: string;
  name: string;
  rating?: number;
  ai_summary?: string;
  summary?: string;
  tags?: string[];
  address?: string;
};

type PricePreference = 'low' | 'medium' | 'high' | 'high-plus';

const priceOptions: { id: PricePreference; label: string }[] = [
  { id: 'low', label: '$' },
  { id: 'medium', label: '$$' },
  { id: 'high', label: '$$$' },
  { id: 'high-plus', label: '$$$$' },
];

export default function Home() {
  const [vibe, setVibe] = useState('');
  const [pricePreference, setPricePreference] = useState<PricePreference>('medium');
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const normalizedPricePreference = pricePreference === 'high-plus' ? 'high' : pricePreference;

  const handleSearch = async () => {
    if (!vibe.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vibe: vibe.trim(),
          price_preference: normalizedPricePreference,
        }),
      });

      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.restaurants ?? [];
      setRestaurants(list);
    } catch (err) {
      console.error('Search error:', err);
      setError('Something went wrong. Please try again.');
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-[100dvh] p-4 bg-slate-950 text-slate-50 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[100px]" />
      </div>

      <div className="z-10 w-full max-w-3xl flex flex-col items-center gap-10">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            CHOWDOWN
          </h1>
          <p className="text-slate-400 font-medium">Find the perfect vibe</p>
        </div>

        <div className="w-full flex flex-col items-center gap-6">
          <div className="w-full">
            <input
              type="text"
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              placeholder="What's the vibe?"
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-6 px-6 text-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-center"
            />
          </div>

          <div className="flex items-center justify-center gap-2">
            {priceOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setPricePreference(option.id)}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${pricePreference === option.id
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-slate-300">
              <Loader2 className="animate-spin" />
              Searching...
            </div>
          )}
          {error && <p className="text-sm text-rose-400">{error}</p>}
        </div>

        <AnimatePresence>
          {!loading && restaurants.length > 0 && (
            <motion.div
              initial="hidden"
              animate="show"
              exit="hidden"
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.08 },
                },
              }}
              className="w-full space-y-4"
            >
              {restaurants.map((restaurant, index) => {
                const tags = restaurant.tags ?? [];
                const summary = restaurant.ai_summary || restaurant.summary || 'No summary available yet.';
                const mapQuery = encodeURIComponent(
                  restaurant.address ? `${restaurant.name} ${restaurant.address}` : restaurant.name
                );

                return (
                  <motion.div
                    key={restaurant.id ?? `${restaurant.name}-${index}`}
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      show: { opacity: 1, y: 0 },
                    }}
                    className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h2 className="text-2xl font-bold text-white">{restaurant.name}</h2>
                        {restaurant.address && (
                          <div className="text-slate-400 text-sm flex items-center gap-1">
                            <MapPin size={14} /> {restaurant.address}
                          </div>
                        )}
                      </div>
                      {typeof restaurant.rating === 'number' && (
                        <div className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-lg text-sm font-bold flex items-center gap-1">
                          <Star size={14} fill="currentColor" /> {restaurant.rating.toFixed(1)}
                        </div>
                      )}
                    </div>

                    <p className="mt-3 text-slate-200 italic">{summary}</p>

                    {tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-slate-800 text-slate-300 px-2 py-1 rounded-lg text-xs font-semibold"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex justify-end">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white text-slate-950 font-bold py-2 px-4 rounded-xl text-sm hover:bg-slate-200 transition-colors"
                      >
                        Go There
                      </a>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
