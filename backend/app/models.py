"""Pydantic models that mirror contracts.md exactly. Change the contract first, then here."""

from __future__ import annotations

from typing import Literal, Union

from pydantic import BaseModel, ConfigDict, Field

Emotion = Literal["happy", "sad", "angry", "fear", "surprise", "disgust", "neutral"]
Platform = Literal["instagram", "tiktok", "youtube", "x", "facebook", "other"]  # other: Reddit, Threads, ... (labels only)
Category = Literal["news", "politics", "comedy", "friends", "fitness", "food", "drama", "ads", "other"]
Tone = Literal["positive", "neutral", "negative"]

NEGATIVE_EMOTIONS = {"sad", "angry", "fear", "disgust"}


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class EmotionSample(_Strict):
    """Raad -> Allen, once a second."""

    ts: float
    emotion: Emotion
    valence: float = Field(ge=-1, le=1)
    confidence: float = Field(ge=0, le=1)


class MoodSwitch(_Strict):
    """Raad -> Giresh, Allen, when a new mood holds 2 s."""

    id: str
    ts: float
    from_: Emotion = Field(alias="from")
    to: Emotion
    platform: Platform


class ContextLabel(_Strict):
    """Giresh -> Allen, one per switch. Never carries the image."""

    switch_id: str
    ts: float
    platform: Platform
    category: Category
    tone: Tone
    topic: str


class Session(_Strict):
    """Allen -> Cheema, one per scroll session. end is null while it is still running."""

    id: str
    platform: Platform
    start: float
    end: float | None = None


Event = Union[EmotionSample, MoodSwitch, ContextLabel]


class SessionStart(_Strict):
    platform: Platform
    start: float | None = None


class SessionEnd(_Strict):
    end: float | None = None


class Timeline(BaseModel):
    session: Session
    emotions: list[EmotionSample]
    switches: list[MoodSwitch]
    labels: list[ContextLabel]
