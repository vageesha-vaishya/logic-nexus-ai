import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, Keyboard, Book, MessageSquare } from "lucide-react";

export function HelpDialog() {
  const shortcuts = [
    { key: "Alt + G", desc: "Go to Dashboard" },
    { key: "Alt + L", desc: "Go to Leads" },
    { key: "Alt + Q", desc: "Go to Quotes" },
    { key: "Alt + I", desc: "Go to Invoices" },
    { key: "Cmd/Ctrl + N", desc: "New record (Contextual)" },
    { key: "/", desc: "Focus search bar" },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <HelpCircle className="h-5 w-5" />
          <span className="sr-only">Help</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Logic Nexus AI Help Center</DialogTitle>
          <DialogDescription>
            Get help with using the platform and discover powerful shortcuts.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold">
              <Keyboard className="h-4 w-4" />
              Keyboard Shortcuts
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {shortcuts.map((s) => (
                <div key={s.key} className="flex justify-between border-b pb-1">
                  <span className="text-muted-foreground">{s.desc}</span>
                  <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{s.key}</kbd>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold">
              <Book className="h-4 w-4" />
              Quick Resources
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <Button variant="outline" className="justify-start gap-2" asChild>
                <a href="/docs" target="_blank">
                  <Book className="h-4 w-4" />
                  View Full Documentation
                </a>
              </Button>
              <Button variant="outline" className="justify-start gap-2" asChild>
                <a href="mailto:support@logicnexus.ai">
                  <MessageSquare className="h-4 w-4" />
                  Contact Support
                </a>
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
