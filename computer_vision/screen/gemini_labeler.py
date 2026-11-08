"""G2: label what the viewer was watching, with Gemini, as context_label fields.

What it sends: up to 3 screenshots, oldest first, from the ~2 seconds before
the mood switch up to the moment of the switch (the cause usually comes a
moment before the face reacts). The newest one is sharp enough to read small
text: account names, captions, hashtags, song titles, subtitles.

What it asks: category, tone, a topic, and the subject when it can be named:
a public figure, film, show, game, character, brand or public page. Visible
text is used first; a famous person may be named from appearance only when
Gemini is confident. Private people are never named or described.

- Model: tries free-tier models in order and remembers the first that works.
  A model that answers "too many requests" rests for 60 s while the next one is
  used, so labels keep coming.
- Output: JSON forced to the contracts.md values. Older google-genai versions
  fall back step by step.
- Privacy: only the screenshots and the platform name are sent (never the
  window title or how the viewer reacted). On the free tier Google may use what
  is sent to improve its products.
- API key: GEMINI_API_KEY (or GOOGLE_API_KEY), or the file screen/gemini_key.txt.
"""
from __future__ import annotations

import itertools
import json
import os
import re
import time
from typing import Dict, List, Optional, Sequence, Union

CATEGORIES = ["news", "politics", "comedy", "friends", "fitness", "food", "drama", "ads", "other"]
TONES = ["positive", "neutral", "negative"]
MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"]
KEY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gemini_key.txt")

PLATFORMS = ["instagram", "tiktok", "youtube", "x", "facebook", "other"]
PLATFORM_NAMES = {"instagram": "Instagram", "tiktok": "TikTok", "youtube": "YouTube", "x": "X (Twitter)",
                  "facebook": "Facebook", "other": "a social media site"}

PROMPT = """You label social media content for a digital well-being app.
You get {n} screenshot(s) from {platform}, oldest first, covering the last {span:.0f} seconds before
the viewer's facial expression changed. The last one is the moment it changed; whatever caused the
change is often in the earlier ones. Focus on the main post, video, reel or story being viewed and
ignore menus, sidebars and system notifications.

Work out what the viewer was watching:
1. Read all visible text: text and subtitles inside the video, the post caption and hashtags, the
   account or page name, the audio or song title, video titles, and the top comments.
2. Name the subject when you can: a public figure (actor, musician, athlete, politician, well-known
   creator), a film, series, game, character, brand or public page. Use visible text first. Name a
   famous person from their appearance only when you are confident. Never name, guess or describe
   private people, and leave out account names of ordinary users.
3. If there is no text, describe the scene and its mood, for example "man crying in car, film scene".

Return JSON:
- "category": one of news, politics, comedy, friends, fitness, food, drama, ads, other.
  friends = personal posts from people the viewer knows; drama = celebrity gossip, feuds, outrage,
  emotional film or TV scenes and edits; ads = sponsored or promoted; comedy = memes, jokes, skits.
- "tone": the emotional tone of the content itself: positive, neutral or negative.
- "subject": the named subject (person, film, show, brand, page), or "" if none can be named.
- "topic": 2 to 8 plain words on what it is about, including the subject when known, for example
  "layoff headlines", "dog learning tricks", "<actor name> heartbreak film edit".
- "evidence": a few words on what you used, for example "caption hashtags, song title".
- "platform": the app or site shown, judged from its layout, logos and buttons: one of instagram,
  tiktok, youtube, x, facebook, other (other = any other social site, such as Reddit or Threads).
"""

SCHEMA = {
    "type": "object",
    "properties": {
        "category": {"type": "string", "enum": CATEGORIES},
        "tone": {"type": "string", "enum": TONES},
        "subject": {"type": "string"},
        "topic": {"type": "string"},
        "evidence": {"type": "string"},
        "platform": {"type": "string", "enum": PLATFORMS},
    },
    "required": ["category", "tone", "subject", "topic", "evidence", "platform"],
}

SYNONYMS = {
    "humor": "comedy", "humour": "comedy", "meme": "comedy", "memes": "comedy", "funny": "comedy", "joke": "comedy",
    "sport": "fitness", "sports": "fitness", "health": "fitness", "exercise": "fitness", "workout": "fitness",
    "cooking": "food", "recipe": "food", "recipes": "food", "restaurant": "food",
    "ad": "ads", "advert": "ads", "advertisement": "ads", "sponsored": "ads", "promotion": "ads", "promoted": "ads",
    "gossip": "drama", "celebrity": "drama", "controversy": "drama", "outrage": "drama", "film": "drama",
    "movie": "drama", "tv": "drama",
    "personal": "friends", "family": "friends", "friend": "friends",
    "political": "politics", "election": "politics", "current events": "news", "headline": "news",
}
TONE_SYNONYMS = {"happy": "positive", "uplifting": "positive", "sad": "negative", "angry": "negative",
                 "upsetting": "negative", "melancholic": "negative", "mixed": "neutral", "informative": "neutral"}

Images = Union[bytes, Sequence[bytes]]


class RateLimited(Exception):
    """Every model said: too many requests (HTTP 429). Wait before trying again."""


def load_key() -> Optional[str]:
    for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        if os.environ.get(name, "").strip():
            return os.environ[name].strip()
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, encoding="utf-8") as f:
            key = f.read().strip()
        return key or None
    return None


def parse_json(text: str) -> dict:
    text = (text or "").strip()
    try:
        return json.loads(text)
    except ValueError:
        m = re.search(r"\{.*\}", text, re.S)       # JSON wrapped in prose or ``` fences
        if not m:
            raise ValueError(f"no JSON in the reply: {text[:80]!r}")
        return json.loads(m.group(0))


def _clean(s, limit: int) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().strip('."'))[:limit]


def normalise(d: dict) -> Dict[str, str]:
    """Contract values (category, tone, topic) plus subject and evidence for the log."""
    cat = str(d.get("category", "other")).strip().lower()
    cat = cat if cat in CATEGORIES else SYNONYMS.get(cat, "other")
    tone = str(d.get("tone", "neutral")).strip().lower()
    tone = tone if tone in TONES else TONE_SYNONYMS.get(tone, "neutral")
    subject = _clean(d.get("subject"), 40)
    if subject.lower() in ("none", "n/a", "unknown", "unclear"):
        subject = ""
    topic = _clean(d.get("topic"), 70)
    if subject and subject.lower() not in topic.lower():
        topic = f"{subject}: {topic}" if topic else subject
    seen = str(d.get("platform", "")).strip().lower().replace("twitter", "x")
    return {"category": cat, "tone": tone, "topic": topic[:80] or "unclear",
            "subject": subject, "evidence": _clean(d.get("evidence"), 80),
            "platform_seen": seen if seen in PLATFORMS else ""}


def _code(err: Exception) -> Optional[int]:
    for attr in ("code", "status_code"):
        v = getattr(err, attr, None)
        if isinstance(v, int):
            return v
    m = re.search(r"\b([45]\d\d)\b", str(err))
    return int(m.group(1)) if m else None


def _trust_windows_certificates() -> None:
    """Same fix as the model downloads: use the Windows certificate store, like pip does."""
    try:
        import truststore
        truststore.inject_into_ssl()
    except Exception:  # noqa: BLE001
        pass


def _pydantic_label():
    from typing import Literal

    from pydantic import BaseModel

    class ContextLabel(BaseModel):
        category: Literal[tuple(CATEGORIES)]  # type: ignore[valid-type]
        tone: Literal[tuple(TONES)]  # type: ignore[valid-type]
        subject: str
        topic: str
        evidence: str
        platform: Literal[tuple(PLATFORMS)]  # type: ignore[valid-type]

    return ContextLabel


class GeminiLabeler:
    name = "gemini"

    def __init__(self, model: Optional[str] = None, api_key: Optional[str] = None,
                 client=None, types=None, timeout_s: float = 25.0, rest_s: float = 60.0):
        if client is None:
            _trust_windows_certificates()
            from google import genai
            from google.genai import types as gtypes
            key = api_key or load_key()
            if not key:
                raise RuntimeError("No Gemini API key. Get a free one at https://aistudio.google.com/apikey "
                                   "and run screen\\setup_screen.bat, or set GEMINI_API_KEY.")
            try:
                client = genai.Client(api_key=key, http_options=gtypes.HttpOptions(timeout=int(timeout_s * 1000)))
            except Exception:  # noqa: BLE001 - older library without http_options
                client = genai.Client(api_key=key)
            types = gtypes
        self.client, self.types = client, types
        self.models = [model] if model else list(MODELS)
        self.thinking = {m: m.startswith("gemini-3") for m in self.models}
        self.schema_mode = "json_schema"           # then "pydantic", then "plain"
        self.rest_s = rest_s
        self.resting: Dict[str, float] = {}        # model -> time it may be used again
        self.model_used: Optional[str] = None

    def _config(self, model: str):
        kw = {"response_mime_type": "application/json", "max_output_tokens": 1024}
        if self.schema_mode == "json_schema":
            kw["response_json_schema"] = SCHEMA
        elif self.schema_mode == "pydantic":
            kw["response_schema"] = _pydantic_label()
        if self.thinking.get(model):
            try:
                kw["thinking_config"] = self.types.ThinkingConfig(thinking_level="minimal")
            except Exception:  # noqa: BLE001 - library too old for thinking_level
                self.thinking[model] = False
        try:
            return self.types.GenerateContentConfig(**kw)
        except Exception:  # noqa: BLE001 - a field this library version does not know
            if "thinking_config" in kw:
                self.thinking[model] = False
            elif self.schema_mode == "json_schema":
                self.schema_mode = "pydantic"
            elif self.schema_mode == "pydantic":
                self.schema_mode = "plain"
            else:
                raise
            return self._config(model)

    def _next_schema_mode(self) -> bool:
        order = ["json_schema", "pydantic", "plain"]
        i = order.index(self.schema_mode)
        if i + 1 < len(order):
            self.schema_mode = order[i + 1]
            return True
        return False

    def label(self, images: Images, platform: Optional[str] = None, span_s: float = 0.0) -> Dict[str, str]:
        """platform: what the window title said, or None/"other" if unknown (Gemini then judges)."""
        jpegs: List[bytes] = [images] if isinstance(images, (bytes, bytearray)) else list(images)
        parts = [self.types.Part.from_bytes(data=j, mime_type="image/jpeg") for j in jpegs]
        where = PLATFORM_NAMES[platform] if platform in PLATFORM_NAMES and platform != "other" \
            else "a social media app or site (which one is for you to judge)"
        prompt = PROMPT.format(n=len(jpegs), platform=where, span=max(span_s, 0.0))
        last: Optional[Exception] = None
        now = time.time()
        usable = [m for m in self.models if self.resting.get(m, 0) <= now]
        if not usable:
            raise RateLimited("every Gemini model is resting after 'too many requests'")
        for model in usable:
            for _attempt in range(4):
                try:
                    resp = self.client.models.generate_content(model=model, contents=parts + [prompt],
                                                               config=self._config(model))
                    data = parse_json(getattr(resp, "text", "") or "")
                    self.models = [model] + [m for m in self.models if m != model]   # remember what works
                    self.model_used = model
                    return normalise(data)
                except ValueError as err:          # reply was not JSON: try once more
                    last = err
                    continue
                except Exception as err:  # noqa: BLE001
                    last, code, msg = err, _code(err), str(err).lower()
                    if code == 429 or "resource_exhausted" in msg or "quota" in msg:
                        self.resting[model] = time.time() + self.rest_s   # rest it, use the next model
                        break
                    if code == 400 and "thinking" in msg and self.thinking.get(model):
                        self.thinking[model] = False
                        continue
                    if code == 400 and ("schema" in msg or "mime" in msg) and self._next_schema_mode():
                        continue
                    if code in (500, 502, 503, 504):
                        time.sleep(0.5)
                        continue
                    if code in (401, 403) or "api key" in msg or "permission" in msg:
                        raise RuntimeError(f"Gemini refused the API key: {err}") from err
                    break                          # 404 or unsupported: try the next model
        if all(self.resting.get(m, 0) > time.time() for m in self.models):
            raise RateLimited(str(last))
        raise RuntimeError(f"No Gemini model worked. Last error: {last}")


class FakeLabeler:
    """No network: canned labels, for testing the wiring without an API key."""
    name = "fake"
    _LABELS = [("news", "negative", "", "layoff headlines"), ("comedy", "positive", "", "cat meme"),
               ("friends", "positive", "", "beach trip photos"), ("drama", "negative", "Example Actor", "heartbreak film edit"),
               ("food", "positive", "", "pasta recipe"), ("ads", "neutral", "Example Brand", "sneaker ad")]

    def __init__(self, delay_s: float = 0.3):
        self.delay_s = delay_s
        self._cycle = itertools.cycle(self._LABELS)
        self.model_used = "fake"
        self.last_images = 0

    def label(self, images: Images, platform: Optional[str] = None, span_s: float = 0.0) -> Dict[str, str]:
        self.last_images = 1 if isinstance(images, (bytes, bytearray)) else len(images)
        self.last_platform_hint = platform
        time.sleep(self.delay_s)
        c, t, subject, topic = next(self._cycle)
        return normalise({"category": c, "tone": t, "subject": subject, "topic": topic, "evidence": "fake"})


def make_labeler(backend: str = "gemini", model: Optional[str] = None):
    if backend == "gemini":
        return GeminiLabeler(model)
    if backend == "fake":
        return FakeLabeler()
    raise ValueError(f"Unknown labeller {backend!r}; use gemini or fake")
