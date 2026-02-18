'use client';

import { useEffect, useState } from 'react';

type Restaurant = {
  id?: string;
  name: string;
  rating?: number;
  ai_summary?: string;
  summary?: string;
  tags?: string[];
  address?: string;
  coordinates?: { lat: number; lng: number };
};

type PricePreference = 'low' | 'medium' | 'high';

const priceOptions: { id: PricePreference; label: string }[] = [
  { id: 'low', label: '$' },
  { id: 'medium', label: '$$' },
  { id: 'high', label: '$$$' },
];

const bootMessages = [
  '> INITIALIZING_CONNECTION...',
  '> BYPASSING_FIREWALL...',
  '> TRIANGULATING_VIBES...',
  '> DOWNLOADING_MENUS...',
];

export default function Home() {
  const [vibe, setVibe] = useState('');
  const [pricePreference, setPricePreference] = useState<PricePreference>('medium');
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bootIndex, setBootIndex] = useState(0);

  useEffect(() => {
    if (!loading) {
      setBootIndex(0);
      return;
    }

    setBootIndex(0);
    const interval = setInterval(() => {
      setBootIndex((prev) => (prev < bootMessages.length ? prev + 1 : prev));
    }, 140);

    return () => clearInterval(interval);
  }, [loading]);

  const handleSearch = async () => {
    if (!vibe.trim()) return;

    setLoading(true);
    setError(null);
    setRestaurants([]);

    try {
      const res = await fetch('/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vibe: vibe.trim(),
          price_preference: pricePreference,
        }),
      });

      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.restaurants ?? [];
      
      if (list.length === 0) {
        setError('SYSTEM::NO_RESULTS_FOUND');
      }
      
      setRestaurants(list);
    } catch (err) {
      console.error('Search error:', err);
      setError('SYSTEM_FAULT::CONNECTION_REFUSED');
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  const renderSummary = (restaurant: Restaurant) =>
    restaurant.ai_summary || restaurant.summary || 'NO_SUMMARY_AVAILABLE';

  const buildMapQuery = (restaurant: Restaurant) => {
    if (restaurant.coordinates) {
      return `${restaurant.coordinates.lat},${restaurant.coordinates.lng}`;
    }
    if (restaurant.address) {
      return `${restaurant.name} ${restaurant.address}`;
    }
    return restaurant.name;
  };

  return (
    <main className="min-h-screen bg-void text-white font-mono selection:bg-neon-purple selection:text-black">
      <div className="mx-auto min-h-screen max-w-4xl border-x-2 border-dashed border-gray-800 px-6 py-10 flex flex-col">
        
        {/* HEADER */}
        <header className="mb-12">
          <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter">
            CHOWDOWN
          </h1>
          <div className="mt-2 w-full h-1 bg-neon-purple shadow-hard" />
        </header>

        {/* INPUT SECTION */}
        <section className="space-y-8 flex-1">
          
          {/* Vibe Input */}
          <div className="space-y-2">
            <label className="text-base text-gray-300 font-bold uppercase tracking-widest">[ INPUT_01 :: VIBE_PARAMETERS ]</label>
            <textarea
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              placeholder="> ENTER_CRAVING_PARAMETERS..."
              className="w-full min-h-[120px] resize-none bg-black border-2 border-neon-purple p-4 text-xl text-white placeholder:text-gray-600 focus:border-neon-purple hover:border-white focus:outline-none focus:shadow-hard transition-all duration-75"
            />
          </div>

          {/* Price Toggles */}
          <div className="space-y-2">
            <div className="text-base text-gray-300 font-bold uppercase tracking-widest">[ INPUT_02 :: BUDGET_CONSTRAINT ]</div>
            <div className="grid grid-cols-3 gap-0 border-2 border-neon-purple hover:border-white">
              {priceOptions.map((option, index) => (
                <button
                  key={option.id}
                  onClick={() => setPricePreference(option.id)}
                  className={`h-16 text-xl font-bold uppercase transition-all duration-75 border-r-2 last:border-r-0 border-white hover:bg-neon-purple hover:text-black ${
                    pricePreference === option.id
                      ? 'bg-neon-purple text-black'
                      : 'bg-black text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="group relative w-full h-20 bg-black border-2 border-neon-purple text-neon-purple font-black text-2xl uppercase tracking-widest shadow-hard hover:translate-y-1 hover:shadow-none hover:bg-neon-purple hover:text-white active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              EXECUTE_SEARCH<span className="animate-pulse">_</span>
            </button>
            {loading && (
              <div className="mt-4 space-y-1 text-sm font-bold text-neon-purple">
                {bootMessages.slice(0, bootIndex).map((message) => (
                  <div key={message}>{message}</div>
                ))}
                <div className="animate-pulse">_</div>
              </div>
            )}
            {error && <div className="mt-4 text-red-500 font-bold text-sm"> ERROR: {error}</div>}
          </div>
        </section>

        {/* RESULTS FEED */}
        <section className="mt-16 space-y-6">
          {restaurants.length > 0 && (
            <div className="text-xs text-gray-500 font-bold uppercase tracking-widest border-b border-gray-800 pb-2 mb-6">
              SYSTEM_LOG :: RESULTS_FOUND ({restaurants.length})
            </div>
          )}

          {restaurants.map((restaurant, index) => {
            const idLabel = String(index + 1).padStart(2, '0');
            const tags = restaurant.tags ?? [];
            const mapQuery = encodeURIComponent(buildMapQuery(restaurant));

            return (
              <div
                key={restaurant.id ?? `${restaurant.name}-${index}`}
                className="group relative border-2 border-neon-purple bg-black p-5 hover:border-white transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="text-neon-purple text-lg font-bold">
                    [ID:{idLabel}] :: {restaurant.name?.toUpperCase()}
                  </div>
                  {restaurant.rating && (
                    <div className="bg-white text-black px-2 py-0.5 text-xs font-bold">
                      RATING: {restaurant.rating}
                    </div>
                  )}
                </div>

                <div className="text-acid text-sm mb-4 font-medium leading-relaxed">
                  &gt;&gt; ANALYSIS: {renderSummary(restaurant)}
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {tags.map((tag) => (
                      <span key={tag} className="border border-gray-600 px-2 py-1 text-[10px] uppercase text-gray-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block border border-white px-4 py-2 text-xs font-bold text-white hover:bg-white hover:text-black uppercase transition-colors"
                >
                  GO_TO_COORDS -&gt;
                </a>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
