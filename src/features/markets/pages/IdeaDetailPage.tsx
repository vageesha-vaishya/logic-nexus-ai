import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Edit2,
  Eye,
  MessageSquare,
  Trash2,
  UserCheck,
  UserPlus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SkeletonCard,
} from "@/design-system";
import { Separator } from "@/components/ui/separator";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { TradingChart } from "../components/TradingChart";
import { IdeaComments } from "../components/IdeaComments";
import { CreateIdeaModal } from "../components/CreateIdeaModal";
import {
  useIdea,
  useDeleteIdea,
  useToggleReaction,
  useUserProfile,
  useFollowUser,
  useUnfollowUser,
} from "../hooks/useIdeas";

const AVATAR_COLORS = [
  "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500",
  "bg-teal-500", "bg-cyan-500", "bg-blue-500", "bg-violet-500",
];

function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function shortUserId(userId: string): string {
  return `@user_${userId.slice(-8)}`;
}

interface ReactionBtnProps {
  emoji: string;
  count: number;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function ReactionBtn({ emoji, count, active, onClick, disabled }: ReactionBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded-xl px-4 py-3 text-sm font-medium transition-all border ${
        active
          ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
          : "bg-muted/50 text-muted-foreground hover:bg-muted border-transparent hover:border-border"
      } disabled:opacity-50`}
    >
      <span className="text-xl">{emoji}</span>
      <span className="tabular-nums text-xs">{count}</span>
    </button>
  );
}

interface DirectionBadgeProps {
  direction: "bullish" | "bearish" | "neutral";
}

function DirectionBadge({ direction }: DirectionBadgeProps) {
  if (direction === "bullish")
    return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">BULLISH</Badge>;
  if (direction === "bearish")
    return <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">BEARISH</Badge>;
  return <Badge variant="secondary">NEUTRAL</Badge>;
}

interface AuthorCardProps {
  userId: string;
  currentUserId: string | undefined;
}

function AuthorCard({ userId, currentUserId }: AuthorCardProps) {
  const profile = useUserProfile(userId);
  const follow = useFollowUser();
  const unfollow = useUnfollowUser();
  const isOwn = userId === currentUserId;

  const handleToggle = async () => {
    try {
      if (profile.data?.is_following) {
        await unfollow.mutateAsync(userId);
      } else {
        await follow.mutateAsync(userId);
      }
    } catch {
      toast.error("Failed to update follow status");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">About the author</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className={`${avatarColor(userId)} text-white font-semibold`}>
              {userId.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{shortUserId(userId)}</p>
            {profile.data && (
              <p className="text-xs text-muted-foreground">
                {profile.data.idea_count} ideas
              </p>
            )}
          </div>
        </div>

        {profile.data && (
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <p className="font-semibold tabular-nums">{profile.data.follower_count}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div className="text-center">
              <p className="font-semibold tabular-nums">{profile.data.following_count}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
          </div>
        )}

        {!isOwn && currentUserId && (
          <Button
            variant={profile.data?.is_following ? "secondary" : "default"}
            size="sm"
            className="w-full gap-1.5"
            onClick={handleToggle}
            disabled={follow.isPending || unfollow.isPending}
          >
            {follow.isPending || unfollow.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : profile.data?.is_following ? (
              <><UserCheck className="h-3.5 w-3.5" />Following</>
            ) : (
              <><UserPlus className="h-3.5 w-3.5" />Follow</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function IdeaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmedDelete, setConfirmedDelete] = useState(false);

  const idea = useIdea(id!);
  const deleteIdea = useDeleteIdea();
  const toggleReaction = useToggleReaction(id!);

  const isOwn = user?.id === idea.data?.user_id;

  const handleDelete = async () => {
    if (!confirmedDelete) {
      setConfirmedDelete(true);
      setTimeout(() => setConfirmedDelete(false), 3000);
      return;
    }
    try {
      await deleteIdea.mutateAsync(id!);
      toast.success("Idea deleted");
      navigate("/dashboard/markets/ideas");
    } catch {
      toast.error("Failed to delete idea");
    }
  };

  const handleReaction = (type: "like" | "fire" | "bookmark") => {
    if (!user) { toast.error("Sign in to react"); return; }
    toggleReaction.mutate(type);
  };

  if (idea.isPending) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl p-4 md:p-6 space-y-4">
          <SkeletonCard lines={6} />
        </div>
      </DashboardLayout>
    );
  }

  if (idea.isError || !idea.data) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl p-4 md:p-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 gap-1">
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                {idea.error instanceof Error ? idea.error.message : "Idea not found"}
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const d = idea.data;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl p-4 md:p-6 space-y-6">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 -ml-2">
          <ArrowLeft className="h-4 w-4" />Back
        </Button>

        {/* Main idea card */}
        <Card>
          <CardContent className="p-5 space-y-4">
            {/* Author + meta */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className={`${avatarColor(d.user_id)} text-white font-semibold text-sm`}>
                    {d.user_id.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{shortUserId(d.user_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DirectionBadge direction={d.direction} />
                {isOwn && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditOpen(true)}
                      title="Edit idea"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 ${confirmedDelete ? "text-destructive" : ""}`}
                      onClick={handleDelete}
                      disabled={deleteIdea.isPending}
                      title={confirmedDelete ? "Click again to confirm" : "Delete idea"}
                    >
                      {deleteIdea.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold leading-snug">{d.title}</h1>

            {/* Chips */}
            {(d.symbol || d.timeframe) && (
              <div className="flex flex-wrap gap-2">
                {d.symbol && (
                  <span className="rounded bg-muted px-2.5 py-1 text-sm font-mono font-semibold">
                    {d.symbol}
                  </span>
                )}
                {d.timeframe && (
                  <span className="rounded bg-muted px-2.5 py-1 text-sm text-muted-foreground">
                    {d.timeframe}
                  </span>
                )}
              </div>
            )}

            {/* Price levels */}
            {(d.target_price != null || d.stop_loss != null || d.entry_price != null) && (
              <div className="flex flex-wrap gap-4 rounded-lg bg-muted/40 px-4 py-3 text-sm">
                {d.entry_price != null && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Entry</p>
                    <p className="font-semibold tabular-nums">₹{d.entry_price.toLocaleString("en-IN")}</p>
                  </div>
                )}
                {d.target_price != null && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Target</p>
                    <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      ₹{d.target_price.toLocaleString("en-IN")}
                    </p>
                  </div>
                )}
                {d.stop_loss != null && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Stop Loss</p>
                    <p className="font-semibold tabular-nums text-rose-500 dark:text-rose-400">
                      ₹{d.stop_loss.toLocaleString("en-IN")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Body */}
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{d.body}</div>

            {/* Reaction row */}
            <div className="flex items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-2">
                <ReactionBtn
                  emoji="👍"
                  count={d.reaction_counts.like}
                  active={d.my_reactions.includes("like")}
                  onClick={() => handleReaction("like")}
                  disabled={toggleReaction.isPending}
                />
                <ReactionBtn
                  emoji="🔥"
                  count={d.reaction_counts.fire}
                  active={d.my_reactions.includes("fire")}
                  onClick={() => handleReaction("fire")}
                  disabled={toggleReaction.isPending}
                />
                <ReactionBtn
                  emoji="🔖"
                  count={d.reaction_counts.bookmark}
                  active={d.my_reactions.includes("bookmark")}
                  onClick={() => handleReaction("bookmark")}
                  disabled={toggleReaction.isPending}
                />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {d.comment_count} comments
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  {d.view_count.toLocaleString()} views
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TradingView chart */}
        {d.symbol && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{d.symbol} Chart</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              <TradingChart symbol={d.symbol} height={360} />
            </CardContent>
          </Card>
        )}

        {/* Author profile */}
        <AuthorCard userId={d.user_id} currentUserId={user?.id} />

        <Separator />

        {/* Comments */}
        <IdeaComments ideaId={id!} />
      </div>

      {/* Edit modal */}
      <CreateIdeaModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editIdea={d}
      />
    </DashboardLayout>
  );
}
