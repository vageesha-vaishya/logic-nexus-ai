"""
Social trade ideas router.

Ideas CRUD
  GET    /v1/ideas                          — paginated feed (all | following)
  POST   /v1/ideas                          — create idea (auth required)
  GET    /v1/ideas/{idea_id}                — single idea detail, bumps view_count
  PUT    /v1/ideas/{idea_id}                — update own idea (auth required)
  DELETE /v1/ideas/{idea_id}                — delete own idea (auth required)

Reactions
  POST   /v1/ideas/{idea_id}/reactions      — toggle reaction (auth required)

Comments
  GET    /v1/ideas/{idea_id}/comments       — list comments
  POST   /v1/ideas/{idea_id}/comments       — add comment (auth required)
  DELETE /v1/ideas/{idea_id}/comments/{comment_id} — delete own comment (auth required)

Social graph
  POST   /v1/users/{user_id}/follow         — follow user (auth required)
  DELETE /v1/users/{user_id}/follow         — unfollow user (auth required)
  GET    /v1/users/{user_id}/profile        — public profile (optional auth)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel

from markets_worker.auth import Auth, AuthContext, bearer, _verify_supabase_jwt
from markets_worker.db import get_supabase

logger = structlog.get_logger()

router_ideas = APIRouter(prefix="/v1/ideas", tags=["ideas"])
router_users = APIRouter(prefix="/v1/users", tags=["social"])


# ── Optional auth helper ──────────────────────────────────────────────────────

def _optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> str | None:
    """Return the authenticated user_id if a valid JWT is present, else None."""
    if not credentials:
        return None
    try:
        claims = _verify_supabase_jwt(credentials.credentials)
        return claims.get("sub")
    except HTTPException:
        return None


# ── Pydantic request/response models ─────────────────────────────────────────

class IdeaCreateBody(BaseModel):
    title: str
    body: str
    symbol: str | None = None
    direction: Literal["bullish", "bearish", "neutral"]
    timeframe: str | None = None
    target_price: float | None = None
    stop_loss: float | None = None
    entry_price: float | None = None


class IdeaUpdateBody(BaseModel):
    title: str | None = None
    body: str | None = None
    symbol: str | None = None
    direction: Literal["bullish", "bearish", "neutral"] | None = None
    timeframe: str | None = None
    target_price: float | None = None
    stop_loss: float | None = None
    entry_price: float | None = None


class ReactionBody(BaseModel):
    reaction_type: Literal["like", "fire", "bookmark"]


class CommentCreateBody(BaseModel):
    body: str
    parent_comment_id: str | None = None


# ── Internal helpers ──────────────────────────────────────────────────────────

def _db():
    return get_supabase()


def _aggregate_reactions(reactions: list[dict]) -> dict:
    """Count reactions by type and return {likes, fires, bookmarks}."""
    counts: dict[str, int] = {"like": 0, "fire": 0, "bookmark": 0}
    for r in reactions:
        rt = r.get("reaction_type")
        if rt in counts:
            counts[rt] += 1
    return {"likes": counts["like"], "fires": counts["fire"], "bookmarks": counts["bookmark"]}


def _get_idea_reactions(idea_id: str) -> list[dict]:
    result = (
        _db()
        .schema("markets")
        .from_("idea_reactions")
        .select("id, idea_id, user_id, reaction_type, created_at")
        .eq("idea_id", idea_id)
        .execute()
    )
    return result.data or []


def _get_my_reactions(idea_id: str, user_id: str) -> list[str]:
    result = (
        _db()
        .schema("markets")
        .from_("idea_reactions")
        .select("reaction_type")
        .eq("idea_id", idea_id)
        .eq("user_id", user_id)
        .execute()
    )
    return [r["reaction_type"] for r in (result.data or [])]


def _get_comment_count(idea_id: str) -> int:
    result = (
        _db()
        .schema("markets")
        .from_("idea_comments")
        .select("id", count="exact")
        .eq("idea_id", idea_id)
        .execute()
    )
    return result.count or 0


def _enrich_idea(idea: dict, user_id: str | None) -> dict:
    """Attach reaction_counts, comment_count, and my_reactions to an idea dict."""
    idea_id = idea["id"]
    reactions = _get_idea_reactions(idea_id)
    idea["reaction_counts"] = _aggregate_reactions(reactions)
    idea["comment_count"] = _get_comment_count(idea_id)
    idea["my_reactions"] = _get_my_reactions(idea_id, user_id) if user_id else []
    return idea


def _fetch_idea_or_404(idea_id: str) -> dict:
    result = (
        _db()
        .schema("markets")
        .from_("ideas")
        .select("*")
        .eq("id", idea_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Idea not found")
    return result.data


# ── Ideas CRUD ────────────────────────────────────────────────────────────────

@router_ideas.get("")
async def list_ideas(
    feed: Literal["all", "following"] = Query(default="all"),
    symbol: str | None = Query(default=None),
    direction: Literal["bullish", "bearish", "neutral"] | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None, description="ISO datetime for keyset pagination"),
    user_id: str | None = Depends(_optional_user_id),
) -> dict:
    """Paginated idea feed. Supports all/following, symbol and direction filters."""
    db = _db()

    # If feed=following, require auth and get followed user IDs
    followed_ids: list[str] = []
    if feed == "following":
        if not user_id:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required for following feed",
            )
        follows_result = (
            db.schema("markets")
            .from_("idea_follows")
            .select("following_id")
            .eq("follower_id", user_id)
            .execute()
        )
        followed_ids = [r["following_id"] for r in (follows_result.data or [])]
        if not followed_ids:
            # No follows yet — return empty feed
            return {"data": [], "next_cursor": None, "total_count": 0}

    # Build query
    q = db.schema("markets").from_("ideas").select("*").eq("is_published", True)

    if feed == "following":
        # PostgREST in_ filter
        q = q.in_("user_id", followed_ids)

    if symbol:
        q = q.eq("symbol", symbol.upper())

    if direction:
        q = q.eq("direction", direction)

    if cursor:
        # Keyset: created_at < cursor (DESC order)
        q = q.lt("created_at", cursor)

    q = q.order("created_at", desc=True).limit(limit + 1)

    result = q.execute()
    rows = result.data or []

    has_more = len(rows) > limit
    data = rows[:limit]
    next_cursor = data[-1]["created_at"] if has_more and data else None

    # Get total count (approximate) — separate query without cursor
    count_q = db.schema("markets").from_("ideas").select("id", count="exact").eq("is_published", True)
    if feed == "following":
        count_q = count_q.in_("user_id", followed_ids)
    if symbol:
        count_q = count_q.eq("symbol", symbol.upper())
    if direction:
        count_q = count_q.eq("direction", direction)
    count_result = count_q.execute()
    total_count = count_result.count or 0

    enriched = [_enrich_idea(idea, user_id) for idea in data]

    logger.info("ideas.list", feed=feed, symbol=symbol, direction=direction, count=len(data))
    return {"data": enriched, "next_cursor": next_cursor, "total_count": total_count}


@router_ideas.post("", status_code=status.HTTP_201_CREATED)
async def create_idea(body: IdeaCreateBody, auth: Auth) -> dict:
    """Create a new trade idea. Auth required."""
    db = _db()
    now_iso = datetime.now(timezone.utc).isoformat()

    payload = {
        "user_id": auth.user_id,
        "title": body.title,
        "body": body.body,
        "direction": body.direction,
        "is_published": True,
        "view_count": 0,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    if body.symbol is not None:
        payload["symbol"] = body.symbol.upper()
    if body.timeframe is not None:
        payload["timeframe"] = body.timeframe
    if body.target_price is not None:
        payload["target_price"] = body.target_price
    if body.stop_loss is not None:
        payload["stop_loss"] = body.stop_loss
    if body.entry_price is not None:
        payload["entry_price"] = body.entry_price

    result = db.schema("markets").from_("ideas").insert(payload).execute()
    rows = result.data or []
    if not rows:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create idea")

    idea = rows[0]
    idea["reaction_counts"] = {"likes": 0, "fires": 0, "bookmarks": 0}
    idea["comment_count"] = 0
    idea["my_reactions"] = []

    logger.info("ideas.created", idea_id=idea["id"], user_id=auth.user_id)
    return idea


@router_ideas.get("/{idea_id}")
async def get_idea(
    idea_id: str,
    user_id: str | None = Depends(_optional_user_id),
) -> dict:
    """Fetch a single idea detail. Increments view_count."""
    idea = _fetch_idea_or_404(idea_id)

    # Increment view count (best-effort, non-blocking)
    try:
        _db().schema("markets").from_("ideas").update(
            {"view_count": (idea.get("view_count") or 0) + 1, "updated_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", idea_id).execute()
        idea["view_count"] = (idea.get("view_count") or 0) + 1
    except Exception as exc:
        logger.warning("ideas.view_count_increment_failed", idea_id=idea_id, error=str(exc))

    enriched = _enrich_idea(idea, user_id)
    logger.info("ideas.viewed", idea_id=idea_id)
    return enriched


@router_ideas.put("/{idea_id}")
async def update_idea(idea_id: str, body: IdeaUpdateBody, auth: Auth) -> dict:
    """Update an idea. Auth required and must own the idea."""
    idea = _fetch_idea_or_404(idea_id)
    if idea.get("user_id") != auth.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You do not own this idea")

    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.title is not None:
        updates["title"] = body.title
    if body.body is not None:
        updates["body"] = body.body
    if body.symbol is not None:
        updates["symbol"] = body.symbol.upper()
    if body.direction is not None:
        updates["direction"] = body.direction
    if body.timeframe is not None:
        updates["timeframe"] = body.timeframe
    if body.target_price is not None:
        updates["target_price"] = body.target_price
    if body.stop_loss is not None:
        updates["stop_loss"] = body.stop_loss
    if body.entry_price is not None:
        updates["entry_price"] = body.entry_price

    result = (
        _db()
        .schema("markets")
        .from_("ideas")
        .update(updates)
        .eq("id", idea_id)
        .execute()
    )
    rows = result.data or []
    updated = rows[0] if rows else {**idea, **updates}

    enriched = _enrich_idea(updated, auth.user_id)
    logger.info("ideas.updated", idea_id=idea_id, user_id=auth.user_id)
    return enriched


@router_ideas.delete("/{idea_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_idea(idea_id: str, auth: Auth) -> None:
    """Delete an idea. Auth required and must own the idea."""
    idea = _fetch_idea_or_404(idea_id)
    if idea.get("user_id") != auth.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You do not own this idea")

    _db().schema("markets").from_("ideas").delete().eq("id", idea_id).execute()
    logger.info("ideas.deleted", idea_id=idea_id, user_id=auth.user_id)


# ── Reactions ─────────────────────────────────────────────────────────────────

@router_ideas.post("/{idea_id}/reactions")
async def toggle_reaction(idea_id: str, body: ReactionBody, auth: Auth) -> dict:
    """Toggle a reaction on an idea. Adds if not present, removes if present."""
    # Ensure idea exists
    _fetch_idea_or_404(idea_id)

    db = _db()
    existing = (
        db.schema("markets")
        .from_("idea_reactions")
        .select("id")
        .eq("idea_id", idea_id)
        .eq("user_id", auth.user_id)
        .eq("reaction_type", body.reaction_type)
        .maybe_single()
        .execute()
    )

    if existing.data:
        # Remove reaction
        db.schema("markets").from_("idea_reactions").delete().eq("id", existing.data["id"]).execute()
        toggled = "removed"
        logger.info("ideas.reaction_removed", idea_id=idea_id, user_id=auth.user_id, reaction=body.reaction_type)
    else:
        # Add reaction
        db.schema("markets").from_("idea_reactions").insert({
            "idea_id": idea_id,
            "user_id": auth.user_id,
            "reaction_type": body.reaction_type,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        toggled = "added"
        logger.info("ideas.reaction_added", idea_id=idea_id, user_id=auth.user_id, reaction=body.reaction_type)

    return {"toggled": toggled, "reaction_type": body.reaction_type}


# ── Comments ──────────────────────────────────────────────────────────────────

@router_ideas.get("/{idea_id}/comments")
async def list_comments(
    idea_id: str,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict]:
    """List comments for an idea, sorted by created_at ASC (top-level first, then replies)."""
    _fetch_idea_or_404(idea_id)

    result = (
        _db()
        .schema("markets")
        .from_("idea_comments")
        .select("*")
        .eq("idea_id", idea_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    rows = result.data or []

    # Sort: parent comments (parent_comment_id IS NULL) before replies, preserving created_at within each group
    top_level = [r for r in rows if r.get("parent_comment_id") is None]
    replies = [r for r in rows if r.get("parent_comment_id") is not None]
    return top_level + replies


@router_ideas.post("/{idea_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_comment(idea_id: str, body: CommentCreateBody, auth: Auth) -> dict:
    """Add a comment to an idea. Auth required."""
    _fetch_idea_or_404(idea_id)

    now_iso = datetime.now(timezone.utc).isoformat()
    payload: dict = {
        "idea_id": idea_id,
        "user_id": auth.user_id,
        "body": body.body,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    if body.parent_comment_id is not None:
        payload["parent_comment_id"] = body.parent_comment_id

    result = _db().schema("markets").from_("idea_comments").insert(payload).execute()
    rows = result.data or []
    if not rows:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create comment")

    logger.info("ideas.comment_added", idea_id=idea_id, user_id=auth.user_id)
    return rows[0]


@router_ideas.delete("/{idea_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(idea_id: str, comment_id: str, auth: Auth) -> None:
    """Delete a comment. Auth required and must own the comment."""
    result = (
        _db()
        .schema("markets")
        .from_("idea_comments")
        .select("id, user_id, idea_id")
        .eq("id", comment_id)
        .eq("idea_id", idea_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Comment not found")

    if result.data.get("user_id") != auth.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You do not own this comment")

    _db().schema("markets").from_("idea_comments").delete().eq("id", comment_id).execute()
    logger.info("ideas.comment_deleted", comment_id=comment_id, user_id=auth.user_id)


# ── Social graph (on router_users) ───────────────────────────────────────────

@router_users.post("/{user_id}/follow")
async def follow_user(user_id: str, auth: Auth) -> dict:
    """Follow a user. Idempotent."""
    if user_id == auth.user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Cannot follow yourself")

    db = _db()
    # Idempotent upsert — PK is (follower_id, following_id)
    db.schema("markets").from_("idea_follows").upsert(
        {
            "follower_id": auth.user_id,
            "following_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="follower_id,following_id",
    ).execute()

    logger.info("social.followed", follower=auth.user_id, following=user_id)
    return {"status": "following"}


@router_users.delete("/{user_id}/follow")
async def unfollow_user(user_id: str, auth: Auth) -> dict:
    """Unfollow a user."""
    _db().schema("markets").from_("idea_follows").delete().eq(
        "follower_id", auth.user_id
    ).eq("following_id", user_id).execute()

    logger.info("social.unfollowed", follower=auth.user_id, following=user_id)
    return {"status": "unfollowed"}


@router_users.get("/{user_id}/profile")
async def get_user_profile(
    user_id: str,
    viewer_id: str | None = Depends(_optional_user_id),
) -> dict:
    """Return a public profile with counts and is_following."""
    db = _db()

    # Follower count
    follower_result = (
        db.schema("markets")
        .from_("idea_follows")
        .select("follower_id", count="exact")
        .eq("following_id", user_id)
        .execute()
    )
    follower_count = follower_result.count or 0

    # Following count
    following_result = (
        db.schema("markets")
        .from_("idea_follows")
        .select("following_id", count="exact")
        .eq("follower_id", user_id)
        .execute()
    )
    following_count = following_result.count or 0

    # Published idea count
    idea_result = (
        db.schema("markets")
        .from_("ideas")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_published", True)
        .execute()
    )
    idea_count = idea_result.count or 0

    # is_following
    is_following = False
    if viewer_id and viewer_id != user_id:
        follow_check = (
            db.schema("markets")
            .from_("idea_follows")
            .select("follower_id")
            .eq("follower_id", viewer_id)
            .eq("following_id", user_id)
            .maybe_single()
            .execute()
        )
        is_following = follow_check.data is not None

    logger.info("social.profile_viewed", user_id=user_id, viewer=viewer_id)
    return {
        "user_id": user_id,
        "follower_count": follower_count,
        "following_count": following_count,
        "idea_count": idea_count,
        "is_following": is_following,
    }
