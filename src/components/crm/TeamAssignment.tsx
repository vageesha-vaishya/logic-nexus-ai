import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  MoreVertical, 
  Shield, 
  Trash2,
  Mail,
  UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string; // Job title
  avatar?: string;
  accessLevel: 'owner' | 'editor' | 'viewer';
}

interface TeamAssignmentProps {
  members: TeamMember[];
  onAddMember?: () => void;
  onUpdateAccess?: (memberId: string, access: TeamMember['accessLevel']) => void;
  onRemoveMember?: (memberId: string) => void;
  className?: string;
}

const getAccessBadge = (level: TeamMember['accessLevel']) => {
  switch (level) {
    case 'owner': return <Badge variant="default" className="bg-primary/90 hover:bg-primary">Owner</Badge>;
    case 'editor': return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">Editor</Badge>;
    case 'viewer': return <Badge variant="outline" className="text-slate-500">Viewer</Badge>;
  }
};

export function TeamAssignment({ 
  members, 
  onAddMember, 
  onUpdateAccess, 
  onRemoveMember,
  className 
}: TeamAssignmentProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Team Members
            </CardTitle>
            <CardDescription>Manage access and roles for this deal</CardDescription>
          </div>
          <Button onClick={onAddMember}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1">
        <ScrollArea className="h-[350px] pr-4">
          <div className="space-y-4">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-background">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback>{member.name[0]}</AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm">{member.name}</h4>
                      {member.accessLevel === 'owner' && (
                        <Shield className="h-3 w-3 text-amber-500 fill-amber-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{member.role}</span>
                      <span>•</span>
                      <span>{member.email}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden sm:block">
                    <Select 
                      defaultValue={member.accessLevel} 
                      disabled={member.accessLevel === 'owner'}
                      onValueChange={(val) => onUpdateAccess?.(member.id, val as TeamMember['accessLevel'])}
                    >
                      <SelectTrigger className="w-[100px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Member actions">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => window.location.href = `mailto:${member.email}`}>
                        <Mail className="mr-2 h-4 w-4" /> Email Member
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={member.accessLevel === 'owner'} onClick={() => onUpdateAccess?.(member.id, 'owner')}>
                         <UserCheck className="mr-2 h-4 w-4" /> Make Owner
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600" 
                        disabled={member.accessLevel === 'owner'}
                        onClick={() => onRemoveMember?.(member.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
