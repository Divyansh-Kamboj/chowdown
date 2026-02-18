import { NextResponse } from "next/server";
import { openai, supabase } from "@/lib/clients";

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
        const { vibe, price_preference } = await req.json();

        if (!vibe || typeof vibe !== "string") {
            return NextResponse.json(EMERGENCY_LIST);
        }

        const { data: embeddingData } = await openai.embeddings.create({
            model: "openai/text-embedding-3-small",
            input: vibe,
        });

        const query_embedding = embeddingData?.[0]?.embedding;

        if (!query_embedding) {
            console.error("Failed to generate embedding");
            return NextResponse.json(EMERGENCY_LIST);
        }

        let min_price: number | null = null;
        let max_price: number | null = null;

        if (price_preference === "low") {
            min_price = 0;
            max_price = 1;
        } else if (price_preference === "medium") {
            min_price = 2;
            max_price = 2;
        } else if (price_preference === "high") {
            min_price = 3;
            max_price = 4;
        }

        const { data, error } = await supabase.rpc("match_places", {
            query_embedding,
            match_threshold: 0.5,
            match_count: 5,
            min_price,
            max_price,
        });

        if (error) {
            console.error("Supabase RPC error:", error);
            return NextResponse.json(EMERGENCY_LIST);
        }

        if (!data || data.length === 0) {
            return NextResponse.json(EMERGENCY_LIST);
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json(EMERGENCY_LIST);
    }
}
