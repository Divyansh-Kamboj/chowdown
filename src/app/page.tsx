'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, Star, Utensils, DollarSign, Loader2, Car, Footprints, RefreshCw } from 'lucide-react';

type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  price_level: number;
  rating: number;
  address: string;
  vibe_short: string;
  must_order_dish: string;
  coordinates: { lat: number; lng: number };
};

export default function Home() {
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [vibe, setVibe] = useState('');
  const [budget, setBudget] = useState('medium'); // low, medium, high
  const [transport, setTransport] = useState('driving'); // driving, walking

  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [winner, setWinner] = useState<Restaurant | null>(null);
  const [loadingText, setLoadingText] = useState('Asking the cool kids...');
  const [currentSpinName, setCurrentSpinName] = useState('???');

  // Skip Logic State
  const [skippedCuisines, setSkippedCuisines] = useState<Record<string, number>>({});

  const loadingMessages = [
    "Asking the cool kids...",
    "Scanning menus...",
    "Consulting the food gods...",
    "Checking wait times...",
    "Reading reviews...",
  ];

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingText(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [loading]);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    setLoadingText("Locating you...");

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      setCoordinates({ lat: latitude, lng: longitude });

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await res.json();
        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || "Unknown Location";
        setLocation(city);
      } catch (error) {
        console.error("Geocoding error:", error);
        alert("Could not find your city. Please enter it manually.");
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Geolocation error:", error);
      setLoading(false);
      alert("Unable to retrieve your location");
    });
  };

  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  // Reset state when filters change
  useEffect(() => {
    setRestaurants([]);
    setSeenIds(new Set());
    setNextPageToken(null);
    setWinner(null);
  }, [location, vibe, budget, transport]);

  const handleSpin = async () => {
    if (!location && !coordinates) {
      alert("Please enter a location first!");
      return;
    }
    if (!vibe) {
      alert("What's the vibe tonight?");
      return;
    }

    setLoading(true);
    setWinner(null);

    // 1. Check if we have unseen restaurants in the current pool
    const unseen = restaurants.filter(r => !seenIds.has(r.id));

    if (unseen.length > 0) {
      // Pick from current pool
      const random = unseen[Math.floor(Math.random() * unseen.length)];
      setSeenIds(prev => new Set(prev).add(random.id));
      setLoading(false);
      startSpinning(restaurants, random); // Pass the specific winner
      return;
    }

    // 2. If no unseen, check if we can fetch more
    // If it's the first fetch (restaurants.length === 0) OR we have a nextPageToken
    if (restaurants.length === 0 || nextPageToken) {
      try {
        const res = await fetch('/api/restaurants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location,
            lat: coordinates?.lat,
            lng: coordinates?.lng,
            vibe,
            budget,
            transport,
            pageToken: nextPageToken // Send token if we have one
          }),
        });

        const data = await res.json();

        // Filter out skipped cuisines (Client side check as well)
        const newRestaurants = data.restaurants.filter((r: Restaurant) => {
          const skipCount = skippedCuisines[r.cuisine] || 0;
          return skipCount < 2;
        });

        if (newRestaurants.length === 0) {
          if (data.nextPageToken) {
            // Recursively fetch next page if this page was empty due to filtering? 
            // For simplicity, just set token and ask user to spin again or handle it.
            // Let's just alert for now.
            setNextPageToken(data.nextPageToken);
            alert("No matching spots in this batch. Spin again to search deeper!");
          } else {
            alert("No restaurants found matching your criteria.");
          }
          setLoading(false);
          return;
        }

        // Append new restaurants
        // Note: Google might return duplicates across pages, so we filter by ID
        const uniqueNew = newRestaurants.filter((r: Restaurant) => !restaurants.some(existing => existing.id === r.id));

        if (uniqueNew.length === 0 && !data.nextPageToken) {
          alert("You've seen everything!");
          setLoading(false);
          return;
        }

        const updatedList = [...restaurants, ...uniqueNew];
        setRestaurants(updatedList);
        setNextPageToken(data.nextPageToken);

        // Pick winner from the NEW batch (or overall unseen)
        const available = uniqueNew.length > 0 ? uniqueNew : updatedList.filter(r => !seenIds.has(r.id));

        if (available.length === 0) {
          alert("You've seen everything!");
          setLoading(false);
          return;
        }

        const random = available[Math.floor(Math.random() * available.length)];
        setSeenIds(prev => new Set(prev).add(random.id));

        setLoading(false);
        startSpinning(updatedList, random);

      } catch (error) {
        console.error("API Error:", error);
        setLoading(false);
        alert("Something went wrong. Try again!");
      }
    } else {
      alert("You've seen all the spots in this area! Try changing filters.");
      setLoading(false);
    }
  };

  const startSpinning = (list: Restaurant[], preSelectedWinner: Restaurant) => {
    setSpinning(true);
    let duration = 2500; // 2.5 seconds
    let intervalTime = 50;
    let elapsed = 0;

    const interval = setInterval(() => {
      const random = list[Math.floor(Math.random() * list.length)];
      setCurrentSpinName(random.name);
      elapsed += intervalTime;

      if (elapsed >= duration) {
        clearInterval(interval);
        setWinner(preSelectedWinner);
        setSpinning(false);
      }
    }, intervalTime);
  };

  const handleSkip = () => {
    if (!winner) return;

    // Increment skip count for this cuisine
    const cuisine = winner.cuisine;
    setSkippedCuisines(prev => ({
      ...prev,
      [cuisine]: (prev[cuisine] || 0) + 1
    }));

    // Filter available restaurants from the CURRENT list
    // We want something that hasn't been seen (except the current winner, which is now "seen" but we want to skip it)
    // Actually, if we skip, we might want to see it again later? 
    // Requirement: "moving your suggestions to a different type and dont reccomend it again"
    // So we should treat it as "seen" and also filter by cuisine if needed.

    const updatedSkipped = { ...skippedCuisines, [cuisine]: (skippedCuisines[cuisine] || 0) + 1 };

    // Find a new winner from the existing pool that matches criteria
    const availableRestaurants = restaurants.filter(r => {
      const skipCount = updatedSkipped[r.cuisine] || 0;
      return skipCount < 2 && r.id !== winner.id && !seenIds.has(r.id);
    });

    if (availableRestaurants.length === 0) {
      // If no options in current pool, try to spin (which will fetch next page if available)
      // But handleSpin expects a user click event structure? No, it's just a function.
      // But handleSpin checks "unseen" from state.
      // Let's just call handleSpin! It handles "unseen" logic and fetching.
      handleSpin();
      return;
    }

    // If we have options in current pool, pick one
    const random = availableRestaurants[Math.floor(Math.random() * availableRestaurants.length)];
    setSeenIds(prev => new Set(prev).add(random.id));
    setWinner(null);
    startSpinning(restaurants, random);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-[100dvh] p-4 bg-slate-950 text-slate-50 overflow-hidden relative">

      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[100px]" />
      </div>

      <div className="z-10 w-full max-w-md flex flex-col items-center gap-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            CHOWDOWN
          </h1>
          <p className="text-slate-400 font-medium">Where are we eating?</p>
        </div>

        {/* Winner View */}
        <AnimatePresence mode="wait">
          {winner && !spinning ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-bold text-white leading-tight">{winner.name}</h2>
                  <p className="text-slate-400 text-sm">{winner.cuisine} • {Array(winner.price_level).fill('$').join('')}</p>
                </div>
                <div className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-lg text-sm font-bold flex items-center gap-1">
                  <Star size={14} fill="currentColor" /> {winner.rating}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-800/50 p-3 rounded-xl">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">The Vibe</p>
                  <p className="text-slate-200">{winner.vibe_short}</p>
                </div>

                <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl">
                  <p className="text-xs text-purple-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                    <Utensils size={12} /> Must Order
                  </p>
                  <p className="text-purple-100 font-medium">{winner.must_order_dish}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSkip}
                  className="flex-1 bg-slate-800 text-slate-300 font-bold py-4 rounded-xl text-center hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw size={20} />
                  SKIP
                </button>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(winner.name + " " + winner.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-[2] bg-white text-slate-950 font-bold py-4 rounded-xl text-center hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Navigation size={20} />
                  GO THERE
                </a>
              </div>

              <button
                onClick={() => setWinner(null)}
                className="w-full text-slate-500 text-sm py-2 hover:text-slate-300 transition-colors"
              >
                Start Over
              </button>
            </motion.div>
          ) : (
            /* Input View */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-6"
            >
              {/* Location Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Location</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="City or Neighborhood"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    />
                  </div>
                  <button
                    onClick={handleUseLocation}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-3 rounded-xl transition-colors"
                    aria-label="Use my location"
                  >
                    <Navigation size={20} />
                  </button>
                </div>
              </div>

              {/* Vibe Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">The Vibe</label>
                <input
                  type="text"
                  value={vibe}
                  onChange={(e) => setVibe(e.target.value)}
                  placeholder="e.g. Cozy, Spicy, Late Night..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                />
              </div>

              {/* Budget Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Budget</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'low', label: '$0-15' },
                    { id: 'medium', label: '$15-30' },
                    { id: 'high', label: '$30+' }
                  ].map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setBudget(b.id)}
                      className={`py-3 rounded-xl font-bold text-sm transition-all ${budget === b.id
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                        }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transport Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTransport('walking')}
                    className={`py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${transport === 'walking'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                      }`}
                  >
                    <Footprints size={16} /> Walking (2mi)
                  </button>
                  <button
                    onClick={() => setTransport('driving')}
                    className={`py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${transport === 'driving'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                      }`}
                  >
                    <Car size={16} /> Driving (7mi)
                  </button>
                </div>
              </div>

              {/* Spin Button */}
              <button
                onClick={handleSpin}
                disabled={loading || spinning || !location}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black text-xl py-6 rounded-2xl shadow-xl shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 transition-all relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      {loadingText}
                    </>
                  ) : spinning ? (
                    currentSpinName
                  ) : (
                    "SPIN THE WHEEL"
                  )}
                </span>
                {/* Shine Effect */}
                <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 group-hover:animate-shine" />
              </button>

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </main>
  );
}
