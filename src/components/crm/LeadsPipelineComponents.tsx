import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TaskScheduler, Task } from '@/components/crm/TaskScheduler';
import { Lead } from '@/pages/dashboard/leads-data';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export interface DashboardStats {
  totalLeads: number;
  wonDeals: number;
  contacted: number;
  highScore: number;
}

export function DashboardOverview({ stats, className }: { stats: DashboardStats; className?: string }) {
  const items = [
    { label: 'Total Leads', value: stats.totalLeads, tone: 'bg-sky-500/10 text-sky-700' },
    { label: 'Won Deals', value: stats.wonDeals, tone: 'bg-emerald-500/10 text-emerald-700' },
    { label: 'Contacted', value: stats.contacted, tone: 'bg-violet-500/10 text-violet-700' },
    { label: 'High Score', value: stats.highScore, tone: 'bg-amber-500/10 text-amber-700' },
  ];

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {items.map((s) => (
        <Card key={s.label} className="transition-colors">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">{s.label}</CardDescription>
            <CardTitle className="text-2xl">{s.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className={s.tone}>{s.label}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ContactsSection({ leads, className }: { leads: Lead[]; className?: string }) {
  const navigate = useNavigate();

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <CardTitle>Contacts</CardTitle>
        <CardDescription>Key people related to active leads</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map(l => (
                <TableRow 
                    key={l.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/dashboard/leads/${l.id}`)}
                >
                  <TableCell className="font-medium">{l.first_name} {l.last_name}</TableCell>
                  <TableCell>{l.company || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{l.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {leads.length === 0 && (
                <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No contacts found
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function TasksSection({ 
    tasks, 
    onAddTask, 
    onCompleteTask, 
    className 
}: { 
    tasks: Task[]; 
    onAddTask?: () => void; 
    onCompleteTask?: (taskId: string) => void;
    className?: string;
}) {
  return (
    <TaskScheduler 
      tasks={tasks}
      onAddTask={onAddTask}
      onCompleteTask={onCompleteTask}
      className={cn(className)}
    />
  );
}

export interface CreateTaskData {
  title: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
  assigned_to?: string;
}

export function CreateTaskDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  loading 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSave: (data: CreateTaskData) => Promise<void>; 
  loading?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ title, due_date: dueDate, priority });
    setTitle('');
    setDueDate('');
    setPriority('medium');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Add a new task to your schedule. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="due_date" className="text-right">
              Due Date
            </Label>
            <Input
              id="due_date"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="priority" className="text-right">
              Priority
            </Label>
            <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
