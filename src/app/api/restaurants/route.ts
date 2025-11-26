import { NextResponse } from "next/server";

const GOOGLE_MAPS_API_KEY = process.env.PLACES_API_KEY;

const EMERGENCY_LIST = [
    {
        id: "e1",
        name: "McDonald's",
        cuisine: "Fast Food",
        price_level: 1,
        rating: 3.5,
        address: "Everywhere",
        vibe_short: "Reliable & Fast",
        must_order_dish: "Big Mac",
        coordinates: { lat: 0, lng: 0 },
    },
    {
        id: "e2",
        name: "Starbucks",
        cuisine: "Coffee",
        price_level: 2,
        rating: 4.0,
        address: "On the corner",
        vibe_short: "Caffeinated",
        must_order_dish: "Caramel Macchiato",
        coordinates: { lat: 0, lng: 0 },
    },
    {
        id: "e3",
        name: "Taco Bell",
        cuisine: "Fast Food",
        price_level: 1,
        rating: 4.5,
        address: "Late Night Spot",
        vibe_short: "Live Más",
        must_order_dish: "Crunchwrap Supreme",
        coordinates: { lat: 0, lng: 0 },
    },
    {
        id: "e4",
        name: "Domino's Pizza",
        cuisine: "Pizza",
        price_level: 1,
        rating: 3.8,
        address: "Delivery",
        vibe_short: "Pizza Night",
        must_order_dish: "Pepperoni Pizza",
        coordinates: { lat: 0, lng: 0 },
    },
    {
        id: "e5",
        name: "Subway",
        cuisine: "Sandwiches",
        price_level: 1,
        rating: 3.7,
        address: "Eat Fresh",
        vibe_short: "Custom Subs",
        must_order_dish: "Italian B.M.T.",
        coordinates: { lat: 0, lng: 0 },
    },
];

export async function POST(req: Request) {
    try {
        const { location, vibe, budget, transport, lat, lng, pageToken } = await req.json();

        if (!GOOGLE_MAPS_API_KEY) {
            console.error("GOOGLE_MAPS_API_KEY is missing");
            return NextResponse.json(EMERGENCY_LIST);
        }

        // Radius Logic
        // Walking: 2 miles = ~3218 meters
        // Driving: 7 miles = ~11265 meters
        const radius = transport === 'driving' ? 11265 : 3218;

        // Budget Logic Mapping to New API Price Levels
        // PRICE_LEVEL_INEXPENSIVE (1): Usually < $15
        // PRICE_LEVEL_MODERATE (2): Usually $15 - $30
        // PRICE_LEVEL_EXPENSIVE (3): Usually $30 - $60
        // PRICE_LEVEL_VERY_EXPENSIVE (4): Usually > $60
        // PRICE_LEVEL_FREE (0): Free

        let priceLevels: string[] = [];

        if (budget === 'low') {
            // Strict: Only Free and Inexpensive ($0-15)
            priceLevels = ["PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE"];
        } else if (budget === 'medium') {
            // Strict: Only Moderate ($15-30). Excludes Inexpensive (McDonald's) and Expensive.
            priceLevels = ["PRICE_LEVEL_MODERATE"];
        } else if (budget === 'high') {
            // Strict: Only Expensive and Very Expensive ($30+)
            priceLevels = ["PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"];
        }

        // Field Mask - Only get what we pay for/need
        const fieldMask = "places.id,places.displayName,places.primaryType,places.types,places.priceLevel,places.rating,places.formattedAddress,places.location";

        let apiUrl = '';
        let requestBody: any = {};

        if (lat && lng) {
            // Nearby Search (New API)
            // apiUrl = "https://places.googleapis.com/v1/places:searchNearby";
            // requestBody = {
            //     includedTypes: ["restaurant", "food"], // Broad types, we filter by vibe/keyword via text search usually, but searchNearby is strictly location based.
            //     // Wait, searchNearby doesn't support "keyword" filtering easily in the same way.
            //     // Actually, for "Vibe" + Location, Text Search is often better even with lat/lng bias.
            //     // However, the user specifically asked for "radius".
            //     // searchNearby supports strict radius.
            //     // But if we want to match "Vibe" (e.g. "Spicy", "Cozy"), searchNearby might not capture that unless we use `includedPrimaryTypes` which is limited.
            //     // Let's stick to Text Search for "Vibe" but with strict location bias?
            //     // OR use Text Search with `locationBias` circle.
            //     // Actually, the user wants "Vibe". "Cozy" isn't a type.
            //     // So we MUST use Text Search to match the vibe keyword.

            //     // Let's switch to Text Search for everything, but use locationBias/Restriction.
            //     // Text Search supports `locationBias` (prefer results here) or `locationRestriction` (only results here).
            //     // We want `locationRestriction` to strictly enforce the radius.
            // };

            // Switching to Text Search for better "Vibe" matching
            apiUrl = "https://places.googleapis.com/v1/places:searchText";
            requestBody = {
                // Vibe Logic:
                // We use the "textQuery" parameter. This searches for places that match the string.
                // By combining "${vibe} restaurants", we ask Google to find places where the "vibe" keyword appears 
                // in the name, reviews, or description (e.g. "Cozy restaurants", "Spicy restaurants").
                textQuery: `${vibe} restaurants`,
                priceLevels: priceLevels.length > 0 ? priceLevels : undefined,
                locationRestriction: {
                    circle: {
                        center: {
                            latitude: lat,
                            longitude: lng
                        },
                        radius: radius
                    }
                },
                // Ensure we get enough results
                maxResultCount: 20,
                pageToken: pageToken // Add pagination token if present
            };

        } else {
            // Fallback Text Search without lat/lng (using text location)
            apiUrl = "https://places.googleapis.com/v1/places:searchText";
            requestBody = {
                textQuery: `${vibe} restaurants in ${location}`,
                priceLevels: priceLevels.length > 0 ? priceLevels : undefined,
                maxResultCount: 20,
                pageToken: pageToken // Add pagination token if present
            };
        }

        const res = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                "X-Goog-FieldMask": fieldMask
            },
            body: JSON.stringify(requestBody)
        });

        const data = await res.json();

        if (!data.places || data.places.length === 0) {
            console.log("No results found from Google Maps API");
            // If it's a pagination request and empty, return empty list (not emergency)
            if (pageToken) return NextResponse.json({ restaurants: [], nextPageToken: null });
            return NextResponse.json({ restaurants: EMERGENCY_LIST, nextPageToken: null });
        }

        // Transform New API data to our schema
        const restaurants = data.places.map((place: any) => {
            // Map Price Level Enum to Number
            let priceNum = 1;
            switch (place.priceLevel) {
                case "PRICE_LEVEL_FREE": priceNum = 0; break;
                case "PRICE_LEVEL_INEXPENSIVE": priceNum = 1; break;
                case "PRICE_LEVEL_MODERATE": priceNum = 2; break;
                case "PRICE_LEVEL_EXPENSIVE": priceNum = 3; break;
                case "PRICE_LEVEL_VERY_EXPENSIVE": priceNum = 4; break;
                default: priceNum = 1;
            }

            // Extract a nice cuisine name from types
            // types is an array of strings like ["restaurant", "italian_restaurant", "food", ...]
            // We want the most specific one that isn't "restaurant" or "food".
            const ignoredTypes = ["restaurant", "food", "point_of_interest", "establishment"];
            const cuisine = place.types?.find((t: string) => !ignoredTypes.includes(t))
                || place.primaryType
                || "Food";

            // Format cuisine name (e.g., "italian_restaurant" -> "Italian")
            const formattedCuisine = cuisine
                .replace(/_restaurant$/, "")
                .split('_')
                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            return {
                id: place.id,
                name: place.displayName?.text || "Unknown Spot",
                cuisine: formattedCuisine,
                price_level: priceNum,
                rating: place.rating || 0,
                address: place.formattedAddress || "Address unavailable",
                vibe_short: vibe, // Still using user input as API doesn't return "vibe"
                must_order_dish: "Check the menu!",
                coordinates: {
                    lat: place.location?.latitude || 0,
                    lng: place.location?.longitude || 0
                },
                // Keep raw price level for strict filtering
                raw_price_level: place.priceLevel
            };
        });

        // STRICT POST-FILTERING
        // Even though we send priceLevels to API, sometimes it's fuzzy. We double check here.
        const filteredRestaurants = restaurants.filter((r: any) => {
            if (priceLevels.length === 0) return true;
            return priceLevels.includes(r.raw_price_level);
        });

        return NextResponse.json({
            restaurants: filteredRestaurants,
            nextPageToken: data.nextPageToken || null
        });

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ restaurants: EMERGENCY_LIST, nextPageToken: null });
    }
}
