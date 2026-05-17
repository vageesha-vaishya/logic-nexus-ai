import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useCreateIdea, useUpdateIdea, type IdeaItem } from "../hooks/useIdeas";

interface CreateIdeaModalProps {
  open: boolean;
  onClose: () => void;
  editIdea?: IdeaItem;
}

interface FormState {
  title: string;
  direction: "bullish" | "bearish" | "neutral";
  symbol: string;
  timeframe: string;
  body: string;
  target_price: string;
  stop_loss: string;
  entry_price: string;
}

const DEFAULT_FORM: FormState = {
  title: "",
  direction: "bullish",
  symbol: "",
  timeframe: "",
  body: "",
  target_price: "",
  stop_loss: "",
  entry_price: "",
};

function toFormState(idea: IdeaItem): FormState {
  return {
    title: idea.title,
    direction: idea.direction,
    symbol: idea.symbol ?? "",
    timeframe: idea.timeframe ?? "",
    body: idea.body,
    target_price: idea.target_price != null ? String(idea.target_price) : "",
    stop_loss: idea.stop_loss != null ? String(idea.stop_loss) : "",
    entry_price: idea.entry_price != null ? String(idea.entry_price) : "",
  };
}

export function CreateIdeaModal({ open, onClose, editIdea }: CreateIdeaModalProps) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const createIdea = useCreateIdea();
  const updateIdea = useUpdateIdea();
  const isPending = createIdea.isPending || updateIdea.isPending;

  useEffect(() => {
    if (open) {
      setForm(editIdea ? toFormState(editIdea) : DEFAULT_FORM);
      setErrors({});
    }
  }, [open, editIdea]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim()) next.title = "Title is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      title: form.title.trim(),
      direction: form.direction,
      body: form.body.trim(),
      symbol: form.symbol.trim() || undefined,
      timeframe: form.timeframe || undefined,
      target_price: form.target_price ? parseFloat(form.target_price) : undefined,
      stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : undefined,
      entry_price: form.entry_price ? parseFloat(form.entry_price) : undefined,
    };

    try {
      if (editIdea) {
        await updateIdea.mutateAsync({ id: editIdea.id, ...payload });
        toast.success("Idea updated");
      } else {
        await createIdea.mutateAsync(payload as any);
        toast.success("Idea shared!");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save idea");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editIdea ? "Edit Trade Idea" : "Share a Trade Idea"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="idea-title">Title *</Label>
            <Input
              id="idea-title"
              placeholder="e.g. RELIANCE breakout above 2800 resistance"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          {/* Direction + Symbol */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Direction</Label>
              <Select value={form.direction} onValueChange={(v) => set("direction", v as FormState["direction"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bullish">Bullish</SelectItem>
                  <SelectItem value="bearish">Bearish</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="idea-symbol">Symbol</Label>
              <Input
                id="idea-symbol"
                placeholder="e.g. RELIANCE"
                value={form.symbol}
                onChange={(e) => set("symbol", e.target.value.toUpperCase())}
                className="font-mono uppercase"
              />
            </div>
          </div>

          {/* Timeframe */}
          <div className="space-y-1.5">
            <Label>Timeframe</Label>
            <Select value={form.timeframe || "__none__"} onValueChange={(v) => set("timeframe", v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                <SelectItem value="1m">1 minute</SelectItem>
                <SelectItem value="5m">5 minutes</SelectItem>
                <SelectItem value="15m">15 minutes</SelectItem>
                <SelectItem value="1h">1 hour</SelectItem>
                <SelectItem value="4h">4 hours</SelectItem>
                <SelectItem value="1D">1 Day</SelectItem>
                <SelectItem value="1W">1 Week</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="idea-body">Analysis</Label>
            <Textarea
              id="idea-body"
              placeholder="Describe your trade rationale, technical setup, catalysts..."
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              rows={5}
              className="resize-none text-sm"
            />
          </div>

          {/* Price levels */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="idea-entry">Entry ₹</Label>
              <Input
                id="idea-entry"
                type="number"
                placeholder="0.00"
                value={form.entry_price}
                onChange={(e) => set("entry_price", e.target.value)}
                min={0}
                step="0.01"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="idea-target">Target ₹</Label>
              <Input
                id="idea-target"
                type="number"
                placeholder="0.00"
                value={form.target_price}
                onChange={(e) => set("target_price", e.target.value)}
                min={0}
                step="0.01"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="idea-sl">Stop Loss ₹</Label>
              <Input
                id="idea-sl"
                type="number"
                placeholder="0.00"
                value={form.stop_loss}
                onChange={(e) => set("stop_loss", e.target.value)}
                min={0}
                step="0.01"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editIdea ? "Save changes" : "Share idea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
