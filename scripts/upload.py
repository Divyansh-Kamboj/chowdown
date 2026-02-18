import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


SCRIPT_DIR = Path(__file__).resolve().parent
DATA_PATH = SCRIPT_DIR / "data" / "enriched_places.json"
BATCH_SIZE = 50
ALLOWED_DB_COLUMNS = {
    "name",
    "address",
    "price_level",
    "rating",
    "review_summary",
    "vibe_tags",
    "embedding",
}


def load_secrets_from_env_local() -> None:
    env_local_path = SCRIPT_DIR.parent / ".env.local"
    if env_local_path.exists():
        load_dotenv(dotenv_path=env_local_path)


def build_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url:
        raise RuntimeError("SUPABASE_URL environment variable is required")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY environment variable is required")

    return create_client(url, key)


def load_places(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Missing data file: {path}")

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("enriched_places.json must contain a JSON array")

    places: list[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict):
            places.append(item)

    return places


def map_to_db_record(item: dict[str, Any]) -> dict[str, Any]:
    db_record = {
        "name": item.get("name"),
        "address": item.get("address"),
        "price_level": item.get("price_level"),
        "rating": item.get("rating"),
        "review_summary": item.get("reviews_summary"),
        "vibe_tags": item.get("tags"),
        "embedding": item.get("embedding"),
    }

    return {key: value for key, value in db_record.items() if key in ALLOWED_DB_COLUMNS}


def map_all_records(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mapped_records: list[dict[str, Any]] = []
    for item in items:
        mapped_records.append(map_to_db_record(item))
    return mapped_records


def chunked(items: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def is_schema_error(error: Exception) -> bool:
    message = str(error).lower()
    schema_markers = [
        "could not find",
        "column",
        "schema",
        "does not exist",
    ]
    return any(marker in message for marker in schema_markers)


def main() -> None:
    try:
        load_secrets_from_env_local()
        supabase = build_supabase_client()
        source_places = load_places(DATA_PATH)
        places = map_all_records(source_places)

        if not places:
            print("No places to upload.")
            return

        batches = chunked(places, BATCH_SIZE)
        uploaded_count = 0
        failed_batches = 0

        for batch_index, batch in enumerate(batches, start=1):
            try:
                print(f"Uploading batch {batch_index}...")
                supabase.table("places").upsert(batch).execute()
                uploaded_count += len(batch)
                print("✅ Batch uploaded")
            except Exception as batch_error:
                failed_batches += 1
                print(f"❌ Batch {batch_index} failed: {batch_error}")
                if is_schema_error(batch_error):
                    print("Stopping upload due to schema mismatch.")
                    break

        if uploaded_count > 0:
            print(f"✅ Successfully uploaded {uploaded_count} places to Supabase.")
        if failed_batches > 0:
            print(f"Completed with {failed_batches} failed batch(es).")
    except Exception as exc:
        print(f"❌ Upload failed: {exc}")


if __name__ == "__main__":
    main()
