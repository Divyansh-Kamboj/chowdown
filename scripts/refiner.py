import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential
from tqdm import tqdm


SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "data"
INPUT_PATH = DATA_DIR / "raw_places.json"
OUTPUT_PATH = DATA_DIR / "enriched_places.json"

SYSTEM_PROMPT = (
    "You are a local Seattle food critic. Analyze the reviews and summary. "
    "Output a strict JSON object with two fields: "
    "1. summary: A 1-sentence 'vibe check' description "
    "(e.g. 'A chaotic but authentic late-night spot...'). "
    "2. tags: A list of 5 short, punchy tags "
    "(e.g. ['Study Friendly', 'Spicy', 'Date Night'])."
)


def load_secrets_from_env_local() -> None:
    env_local_path = SCRIPT_DIR.parent / ".env.local"
    if env_local_path.exists():
        load_dotenv(dotenv_path=env_local_path)


def build_client() -> OpenAI:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY environment variable is required")

    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        default_headers={
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Chowdown",
        },
    )


def extract_editorial_summary(place: dict[str, Any]) -> str:
    editorial_summary = place.get("editorial_summary")
    if isinstance(editorial_summary, dict):
        return str(editorial_summary.get("overview", "")).strip()
    if isinstance(editorial_summary, str):
        return editorial_summary.strip()
    return ""


def extract_top_reviews_text(place: dict[str, Any], limit: int = 3) -> str:
    reviews = place.get("reviews") or []
    if not isinstance(reviews, list):
        return ""

    review_texts: list[str] = []
    for review in reviews:
        if not isinstance(review, dict):
            continue
        text = str(review.get("text", "")).strip()
        if text:
            review_texts.append(text)
        if len(review_texts) >= limit:
            break

    return "\n".join(f"{idx + 1}. {text}" for idx, text in enumerate(review_texts))


@retry(reraise=True, stop=stop_after_attempt(4), wait=wait_exponential(multiplier=1, min=1, max=20))
def generate_vibe(client: OpenAI, place: dict[str, Any]) -> dict[str, Any]:
    name = str(place.get("name", "Unknown Place")).strip()
    editorial_summary = extract_editorial_summary(place)
    top_reviews = extract_top_reviews_text(place)

    user_prompt = (
        f"Name: {name}\n"
        f"Editorial Summary: {editorial_summary or 'N/A'}\n"
        f"Top Reviews:\n{top_reviews or 'N/A'}\n\n"
        "Return only strict JSON with keys: summary, tags."
    )

    response = client.chat.completions.create(
        model="openai/gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

    content = response.choices[0].message.content or "{}"
    parsed = json.loads(content)

    summary = str(parsed.get("summary", "")).strip()
    tags_raw = parsed.get("tags", [])

    if not isinstance(tags_raw, list):
        tags_raw = [tags_raw]

    tags = [str(tag).strip() for tag in tags_raw if str(tag).strip()]
    if len(tags) > 5:
        tags = tags[:5]

    if not summary:
        summary = "Popular local spot with a distinct neighborhood vibe."
    if not tags:
        tags = ["Seattle", "Neighborhood Gem", "Casual", "Food", "Local Favorite"]

    return {"summary": summary, "tags": tags}


@retry(reraise=True, stop=stop_after_attempt(4), wait=wait_exponential(multiplier=1, min=1, max=20))
def get_embedding(client: OpenAI, text: str) -> list[float]:
    response = client.embeddings.create(
        input=text,
        model="text-embedding-3-small",
    )
    return response.data[0].embedding


def main() -> None:
    load_secrets_from_env_local()
    client = build_client()

    with INPUT_PATH.open("r", encoding="utf-8") as f:
        places = json.load(f)

    enriched_places: list[dict[str, Any]] = []

    for place in tqdm(places, desc="Refining places", unit="place"):
        try:
            vibe = generate_vibe(client, place)
            name = str(place.get("name", "")).strip()
            summary = vibe["summary"]
            tags = vibe["tags"]

            embedding_input = f"{name}: {summary} {', '.join(tags)}"
            embedding = get_embedding(client, embedding_input)

            enriched_place = {
                "id": place.get("place_id"),
                "name": name,
                "address": place.get("formatted_address"),
                "price_level": place.get("price_level"),
                "rating": place.get("rating"),
                "reviews_summary": summary,
                "tags": tags,
                "embedding": embedding,
            }
            enriched_places.append(enriched_place)
        except Exception as exc:
            place_name = place.get("name", "Unknown Place")
            tqdm.write(f"Skipping {place_name}: {exc}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(enriched_places, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(enriched_places)} enriched places to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
