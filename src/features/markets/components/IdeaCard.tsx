import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Eye, UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge, Avatar, AvatarFallback, Button, Card, CardContent } from "@/design-system";
import { useAuth } from "@/hooks/useAuth";
import {
  useToggleReaction,
  useFollowUser,
  useUnfollowUser,
  useUserProfile,
  type IdeaItem,
} from "../hooks/useIdeas";

function avatarColor(userId: string): string {
  const colors = [
    "bg-rose-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-blue-500",
    "bg-violet-500",
    "bg-pink-500",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

function shortUserId(userId: string): string {
  return `@user_${userId.slice(-8)}`;
}

function DirectionBadge({ direction }: { direction: IdeaItem["direction"] }) {
  if (direction === "bullish")
    return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">BULLISH</Badge>;
  if (direction === "bearish")
    return <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20">BEARISH</Badge>;
  return <Badge variant="secondary">NEUTRAL</Badge>;
}

interface FollowButtonProps {
  authorId: string;
  currentUserId: string;
}

function FollowButton({ authorId, currentUserId }: FollowButtonProps) {
  const profile = useUserProfile(authorId);
  const follow = useFollowUser();
  const unfollow = useUnfollowUser();

  if (authorId === currentUserId) return null;

  const isFollowing = profile.data?.is_following ?? false;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (isFollowing) {
        await unfollow.mutateAsync(authorId);
      } else {
        await follow.mutateAsync(authorId);
      }
    } catch {
      toast.error("Failed to update follow status");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 gap-1 text-xs"
      onClick={handleClick}
      disabled={follow.isPending || unfollow.isPending}
    >
      {isFollowing ? (
        <><UserCheck className="h-3 w-3" />Following</>
      ) : (
        <><UserPlus className="h-3 w-3" />Follow</>
      )}
    </Button>
  );
}

interface ReactionButtonProps {
  emoji: string;
  count: number;
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function ReactionButton({ emoji, count, active, onClick }: ReactionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-primary/15 text-primary border border-primary/30"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
      }`}
    >
      <span>{emoji}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

interface IdeaCardProps {
  idea: IdeaItem;
  onOpenDetail?: (id: string) => void;
}

export function IdeaCard({ idea, onOpenDetail }: IdeaCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const toggleReaction = useToggleReaction(idea.id);

  const MAX_BODY = 200;
  const needsTruncate = idea.body.length > MAX_BODY;
  const displayBody = needsTruncate && !expanded ? `${idea.body.slice(0, MAX_BODY)}…` : idea.body;

  const handleTitleClick = () => {
    if (onOpenDetail) {
      onOpenDetail(idea.id);
    } else {
      navigate(`/dashboard/markets/ideas/${idea.id}`);
    }
  };

  const handleReaction = (type: "like" | "fire" | "bookmark") => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Sign in to react"); return; }
    toggleReaction.mutate(type);
  };

  const relativeTime = formatDistanceToNow(new Date(idea.created_at), { addSuffix: true });
  const colorClass = avatarColor(idea.user_id);

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Author row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className={`${colorClass} text-white text-xs font-semibold`}>
                {idea.user_id.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <span className="text-sm font-medium truncate block">{shortUserId(idea.user_id)}</span>
              <span className="text-xs text-muted-foreground">{relativeTime}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DirectionBadge direction={idea.direction} />
            {user && (
              <FollowButton authorId={idea.user_id} currentUserId={user.id} />
            )}
          </div>
        </div>

        {/* Title */}
        <button
          onClick={handleTitleClick}
          className="text-left w-full font-semibold text-sm leading-snug hover:text-primary transition-colors"
        >
          {idea.title}
        </button>

        {/* Chips */}
        {(idea.symbol || idea.timeframe) && (
          <div className="flex flex-wrap gap-1.5">
            {idea.symbol && (
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-medium text-foreground">
                {idea.symbol}
              </span>
            )}
            {idea.timeframe && (
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {idea.timeframe}
              </span>
            )}
          </div>
        )}

        {/* Body */}
        <div className="text-sm text-muted-foreground leading-relaxed">
          {displayBody}
          {needsTruncate && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              className="ml-1 text-primary hover:underline text-xs font-medium"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>

        {/* Target/SL bar */}
        {(idea.target_price != null || idea.stop_loss != null) && (
          <div className="flex flex-wrap gap-3 text-xs rounded-md bg-muted/40 px-3 py-2">
            {idea.entry_price != null && (
              <span>
                <span className="text-muted-foreground">Entry</span>{" "}
                <span className="font-medium tabular-nums">
                  ₹{idea.entry_price.toLocaleString("en-IN")}
                </span>
              </span>
            )}
            {idea.target_price != null && (
              <span>
                <span className="text-muted-foreground">Target</span>{" "}
                <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                  ₹{idea.target_price.toLocaleString("en-IN")}
                </span>
              </span>
            )}
            {idea.stop_loss != null && (
              <span>
                <span className="text-muted-foreground">SL</span>{" "}
                <span className="font-medium tabular-nums text-rose-500 dark:text-rose-400">
                  ₹{idea.stop_loss.toLocaleString("en-IN")}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Reactions + meta */}
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-1.5">
            <ReactionButton
              emoji="👍"
              count={idea.reaction_counts.like}
              active={idea.my_reactions.includes("like")}
              onClick={handleReaction("like")}
            />
            <ReactionButton
              emoji="🔥"
              count={idea.reaction_counts.fire}
              active={idea.my_reactions.includes("fire")}
              onClick={handleReaction("fire")}
            />
            <ReactionButton
              emoji="🔖"
              count={idea.reaction_counts.bookmark}
              active={idea.my_reactions.includes("bookmark")}
              onClick={handleReaction("bookmark")}
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {idea.comment_count}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {idea.view_count.toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
