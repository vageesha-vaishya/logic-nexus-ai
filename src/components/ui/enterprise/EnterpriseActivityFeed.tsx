import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Clock, Paperclip, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

interface ActivityMessage {
    id: string;
    author: string;
    avatar?: string;
    content: string;
    createdAt: Date;
    type: 'message' | 'note' | 'activity';
    attachments?: string[];
}

export function EnterpriseActivityFeed({ className }: { className?: string }) {
    const [messages, setMessages] = useState<ActivityMessage[]>([
        {
            id: '1',
            author: 'System',
            content: 'Record created',
            createdAt: new Date(),
            type: 'note',
        }
    ]);
    const [newMessage, setNewMessage] = useState('');

    const handleSend = () => {
        if (!newMessage.trim()) return;
        setMessages([
            ...messages,
            {
                id: Date.now().toString(),
                author: 'You', // TODO: Get from auth
                content: newMessage,
                createdAt: new Date(),
                type: 'message',
            }
        ]);
        setNewMessage('');
    };

    return (
        <div className={cn("w-[350px] border-l bg-muted/10 h-full flex flex-col", className)}>
            <div className="p-4 border-b bg-white flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Activity</h3>
                <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Clock className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((msg) => (
                    <div key={msg.id} className="flex gap-3 group">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {msg.author.charAt(0)}
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-foreground">{msg.author}</span>
                                <span className="text-xs text-muted-foreground">{format(msg.createdAt, 'MMM d, h:mm a')}</span>
                            </div>
                            <div className="text-sm text-foreground bg-white p-3 rounded-lg border shadow-sm group-hover:shadow-md transition-shadow">
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 bg-white border-t mt-auto sticky bottom-0">
                <div className="flex items-center gap-2 bg-muted/20 p-2 rounded-lg border focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <Input 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Log a note or send a message..." 
                        className="border-0 bg-transparent focus-visible:ring-0 px-2 h-auto py-1 shadow-none"
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    />
                    <Button size="icon" onClick={handleSend} disabled={!newMessage.trim()}>
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground px-2">
                    <button className="hover:text-primary transition-colors flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> Log Note
                    </button>
                    <button className="hover:text-primary transition-colors flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Schedule Activity
                    </button>
                </div>
            </div>
        </div>
    );
}
