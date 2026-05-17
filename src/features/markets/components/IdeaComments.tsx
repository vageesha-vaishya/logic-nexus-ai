import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Loader2, MessageSquare, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, Button } from "@/design-system";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  useIdeaComments,
  useAddComment,
  useDeleteComment,
  type Comment,
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

interface CommentRowProps {
  comment: Comment;
  isNested?: boolean;
  currentUserId: string | undefined;
  onDelete: (id: string) => void;
  deleting: boolean;
  onReply?: (commentId: string) => void;
}

function CommentRow({ comment, isNested, currentUserId, onDelete, deleting, onReply }: CommentRowProps) {
  const isOwn = currentUserId === comment.user_id;
  return (
    <div className={`flex gap-3 ${isNested ? "ml-8 mt-2" : ""}`}>
      {isNested && (
        <div className="shrink-0 mt-2.5 text-muted-foreground">
          <CornerDownRight className="h-3.5 w-3.5" />
        </div>
      )}
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarFallback className={`${avatarColor(comment.user_id)} text-white text-xs font-semibold`}>
          {comment.user_id.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium">{shortUserId(comment.user_id)}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm mt-0.5 leading-relaxed break-words">{comment.body}</p>
        <div className="flex items-center gap-2 mt-1">
          {!isNested && onReply && (
            <button
              onClick={() => onReply(comment.id)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Reply
            </button>
          )}
          {isOwn && (
            <button
              onClick={() => onDelete(comment.id)}
              disabled={deleting}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface AddCommentFormProps {
  onSubmit: (body: string, parentId?: string) => Promise<void>;
  loading: boolean;
  placeholder?: string;
  parentId?: string;
  onCancel?: () => void;
}

function AddCommentForm({ onSubmit, loading, placeholder, parentId, onCancel }: AddCommentFormProps) {
  const [text, setText] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    await onSubmit(trimmed, parentId);
    setText("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? "Write a comment…"}
        rows={2}
        className="resize-none text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (text.trim() && !loading) handleSubmit(e as any);
          }
        }}
      />
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!text.trim() || loading}>
          {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Post
        </Button>
      </div>
    </form>
  );
}

interface IdeaCommentsProps {
  ideaId: string;
}

export function IdeaComments({ ideaId }: IdeaCommentsProps) {
  const { user } = useAuth();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const comments = useIdeaComments(ideaId);
  const addComment = useAddComment(ideaId);
  const deleteComment = useDeleteComment(ideaId);

  const allComments = comments.data ?? [];
  const topLevel = allComments.filter((c) => !c.parent_comment_id);
  const replies = (parentId: string) => allComments.filter((c) => c.parent_comment_id === parentId);

  const handleAdd = async (body: string, parentId?: string) => {
    try {
      await addComment.mutateAsync({ body, parent_comment_id: parentId });
      setReplyingTo(null);
    } catch {
      toast.error("Failed to post comment");
    }
  };

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId);
    try {
      await deleteComment.mutateAsync(commentId);
    } catch {
      toast.error("Failed to delete comment");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          Comments{allComments.length > 0 ? ` (${allComments.length})` : ""}
        </h3>
      </div>

      {user && (
        <AddCommentForm
          onSubmit={handleAdd}
          loading={addComment.isPending}
          placeholder="Share your thoughts on this idea…"
        />
      )}

      {comments.isPending && (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading comments…
        </div>
      )}

      {comments.isSuccess && allComments.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No comments yet. Be the first!</p>
      )}

      {topLevel.length > 0 && (
        <div className="space-y-4">
          {topLevel.map((comment) => (
            <div key={comment.id}>
              <CommentRow
                comment={comment}
                currentUserId={user?.id}
                onDelete={handleDelete}
                deleting={deletingId === comment.id}
                onReply={(id) => setReplyingTo(replyingTo === id ? null : id)}
              />

              {/* Replies */}
              {replies(comment.id).map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={reply}
                  isNested
                  currentUserId={user?.id}
                  onDelete={handleDelete}
                  deleting={deletingId === reply.id}
                />
              ))}

              {/* Reply form */}
              {replyingTo === comment.id && user && (
                <div className="ml-8 mt-2">
                  <AddCommentForm
                    onSubmit={handleAdd}
                    loading={addComment.isPending}
                    placeholder={`Replying to ${shortUserId(comment.user_id)}…`}
                    parentId={comment.id}
                    onCancel={() => setReplyingTo(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
