"""
AI service — menu extraction via Gemini / Claude with automatic fallback.
"""

import re
import json
import base64

from google import genai
from google.genai import types
from anthropic import AsyncAnthropic

from core.config import get_settings

settings = get_settings()


# ─── System Prompt ─────────────────────────────────────────

SYSTEM_PROMPT = """
You are a menu extraction assistant for a restaurant management app.
Your job is to look at a restaurant menu image and extract all dishes.

Return ONLY a valid JSON array. No markdown, no explanation, no preamble.
Each object in the array must follow this exact schema:
{
  "name": "string (dish name, required)",
  "description": "string or null (brief description if visible)",
  "price": number or null (numeric value only, no currency symbol),
  "category": "string (e.g. Starters, Mains, Desserts, Drinks)",
  "is_veg": boolean or null (true if vegetarian, false if not, null if unclear)
}

Rules:
- Group items into logical categories based on menu structure
- If price is unclear or missing use null
- If description is not on the menu use null
- Infer is_veg from item name or description where possible
- Do not invent items that are not clearly visible in the image
- If the image is too blurry or unreadable return an empty array []
"""


# ─── JSON Parser ───────────────────────────────────────────

def parse_ai_response(raw_text: str) -> list[dict]:
    """Parse AI response into a list of menu item dicts."""
    text = raw_text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
        text = text.strip()

    parsed = json.loads(text)

    if not isinstance(parsed, list):
        raise ValueError("AI response is not a JSON array")

    cleaned = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        if not item.get("name"):
            continue
        cleaned.append({
            "name": str(item.get("name", "")).strip(),
            "description": item.get("description") or None,
            "price": float(item["price"]) if item.get("price") is not None else None,
            "category": str(item.get("category", "Uncategorized")).strip(),
            "is_veg": item.get("is_veg"),
        })

    return cleaned


# ─── Provider: Gemini ──────────────────────────────────────

async def extract_with_gemini(image_bytes: bytes, mime_type: str) -> list[dict]:
    """Extract menu items using Google Gemini SDK."""
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    response = await client.aio.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=[
            types.Content(
                parts=[
                    types.Part(
                        inline_data=types.Blob(
                            mime_type=mime_type,
                            data=image_bytes,
                        )
                    ),
                    types.Part(text="Extract all menu items from this image."),
                ]
            )
        ],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
        ),
    )

    raw = response.text
    return parse_ai_response(raw)


# ─── Provider: Claude ──────────────────────────────────────

async def extract_with_claude(image_bytes: bytes, mime_type: str) -> list[dict]:
    """Extract menu items using Anthropic Claude."""
    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    b64_image = base64.standard_b64encode(image_bytes).decode("utf-8")

    response = await client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime_type,
                            "data": b64_image,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Extract all menu items from this image.",
                    },
                ],
            }
        ],
    )

    raw = response.content[0].text
    return parse_ai_response(raw)


# ─── Main Extraction Orchestrator ──────────────────────────

async def extract_menu_from_image(image_bytes: bytes, mime_type: str) -> dict:
    """Try primary provider, fallback to secondary, return results."""
    primary = settings.AI_PRIMARY_PROVIDER
    fallback = settings.AI_FALLBACK_PROVIDER

    provider_map = {
        "gemini": extract_with_gemini,
        "claude": extract_with_claude,
    }

    # Step 1: Try primary
    try:
        items = await provider_map[primary](image_bytes, mime_type)
        print(f"[AI] {primary} extracted {len(items)} items")
        return {
            "items": items,
            "provider_used": primary,
            "fallback_used": False,
            "warning": None,
        }
    except Exception as primary_error:
        print(f"[AI] Primary provider ({primary}) failed: {primary_error}")
        print(f"[AI] Trying fallback ({fallback})...")

    # Step 2: Try fallback
    try:
        items = await provider_map[fallback](image_bytes, mime_type)
        print(f"[AI] {fallback} (fallback) extracted {len(items)} items")
        return {
            "items": items,
            "provider_used": fallback,
            "fallback_used": True,
            "warning": None,
        }
    except Exception as fallback_error:
        print(f"[AI] Fallback provider ({fallback}) also failed: {fallback_error}")

    # Step 3: Both failed
    return {
        "items": [],
        "provider_used": None,
        "fallback_used": True,
        "warning": "Could not extract menu automatically. Please add items manually.",
    }
