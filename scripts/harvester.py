import json
import os
import time
from pathlib import Path

import googlemaps
from dotenv import load_dotenv
from tqdm import tqdm


ANCHORS = [
    (47.6570, -122.3131),  # South Anchor
    (47.6612, -122.3131),  # Central Anchor
    (47.6660, -122.3131),  # North Anchor
]

RADIUS_METERS = 500
PLACE_TYPE = "restaurant"

DETAIL_FIELDS = [
    "place_id",
    "name",
    "formatted_address",
    "price_level",
    "rating",
    "user_ratings_total",
    "website",
    "opening_hours",
    "reviews",
    "editorial_summary",
]


def fetch_nearby_places(gmaps_client, location, radius, place_type):
    results = []
    response = gmaps_client.places_nearby(
        location=location,
        radius=radius,
        type=place_type,
    )
    results.extend(response.get("results", []))

    next_page_token = response.get("next_page_token")
    while next_page_token:
        time.sleep(2)
        response = gmaps_client.places_nearby(
            location=location,
            radius=radius,
            type=place_type,
            page_token=next_page_token,
        )
        results.extend(response.get("results", []))
        next_page_token = response.get("next_page_token")

    return results


def enrich_places(gmaps_client, place_ids):
    enriched = []
    for place_id in tqdm(place_ids, desc="Enriching places", unit="place"):
        details = gmaps_client.place(place_id=place_id, fields=DETAIL_FIELDS)
        result = details.get("result")
        if result:
            enriched.append(result)
    return enriched


def load_secrets_from_env_local():
    env_local_path = Path(__file__).resolve().parent.parent / ".env.local"
    if not env_local_path.exists():
        raise FileNotFoundError(f"Missing env file: {env_local_path}")

    # Load all key/value pairs from .env.local into process env.
    load_dotenv(dotenv_path=env_local_path)


def main():
    load_secrets_from_env_local()

    api_key = os.getenv("PLACES_API_KEY")
    if not api_key:
        raise RuntimeError("PLACES_API_KEY environment variable is required")

    gmaps_client = googlemaps.Client(key=api_key)

    deduped = {}
    for anchor in ANCHORS:
        nearby = fetch_nearby_places(gmaps_client, anchor, RADIUS_METERS, PLACE_TYPE)
        for place in nearby:
            place_id = place.get("place_id")
            if place_id and place_id not in deduped:
                deduped[place_id] = place

    enriched = enrich_places(gmaps_client, list(deduped.keys()))

    output_dir = Path("/Users/divyansh/Desktop/chowdown/chowdown/scripts/data")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "raw_places.json"

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
