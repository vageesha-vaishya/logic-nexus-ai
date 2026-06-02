import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCRM } from "@/hooks/useCRM";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Loader2, Trash2, UserPlus, ShieldAlert } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Tables } from "@/integrations/supabase/types";

interface EmailAccount {
  id: string;
  display_name: string;
  email_address: string;
}

interface EmailDelegationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: EmailAccount | null;
}

interface Delegate {
  id: string;
  user_id: string;
  permissions: string[];
  requires_mfa: boolean;
  user: {
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string;
  };
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
}

type DelegationRow = Pick<Tables<"email_account_delegations">, "id" | "delegate_user_id" | "permissions" | "requires_mfa">;

export function EmailDelegationDialog({ open, onOpenChange, account }: EmailDelegationDialogProps) {
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [requireMFA, setRequireMFA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();
  const { context } = useCRM();

  useEffect(() => {
    if (open && account) {
      fetchData();
    }
  }, [open, account]);

  const fetchData = async () => {
    if (!account) return;
    setLoading(true);
    try {
      // Fetch existing delegations
      const { data: delegationsRaw, error: delError } = await supabase
        .from("email_account_delegations")
        .select(`id, delegate_user_id, permissions, requires_mfa`)
        .eq("email_account_id", account.id);

      if (delError) throw delError;

      const delegations = (delegationsRaw || []) as DelegationRow[];

      // Get user details for delegates
      const delegateUserIds = delegations.map(d => d.delegate_user_id);
      let delegatesWithUsers: Delegate[] = [];

      if (delegateUserIds.length > 0) {
        const { data: users, error: userError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, avatar_url")
          .in("id", delegateUserIds);

        if (userError) throw userError;

        delegatesWithUsers = delegations.map(d => ({
          id: d.id,
          user_id: d.delegate_user_id,
          permissions: d.permissions as string[],
          requires_mfa: d.requires_mfa,
          user: users?.find((u: any) => u.id === d.delegate_user_id) || { first_name: 'Unknown', last_name: 'User', email: '' }
        }));
      }

      setDelegates(delegatesWithUsers);

      // Fetch available users (potential delegates)
      let scopeUserIds: string[] = [];
      
      if (context.franchiseId) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("franchise_id", context.franchiseId);
        scopeUserIds = (roles as any[])?.map(r => r.user_id) || [];
      } else if (context.tenantId) {
         const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("tenant_id", context.tenantId);
        scopeUserIds = (roles as any[])?.map(r => r.user_id) || [];
      }

      let userQuery = supabase
        .from("profiles")
        .select("id, first_name, last_name, email, avatar_url")
        .neq("id", context.userId || '');

      if (scopeUserIds.length > 0) {
        userQuery = userQuery.in("id", scopeUserIds);
      }
      
      // Exclude already delegated users
      if (delegateUserIds.length > 0) {
        userQuery = userQuery.not('id', 'in', `(${delegateUserIds.join(',')})`);
      }

      const { data: users, error: potentialError } = await userQuery.limit(50);
      
      if (potentialError) throw potentialError;
      setAvailableUsers(users || []);

    } catch (error: any) {
      toast({
        title: "Error fetching delegations",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddDelegate = async () => {
    if (!account || !selectedUserId) return;
    setAdding(true);
    try {
      const { error } = await (supabase
        .from("email_account_delegations") as any)
        .insert({
          email_account_id: account.id,
          delegate_user_id: selectedUserId,
          permissions: ["read", "send"],
          requires_mfa: requireMFA
        });

      if (error) throw error;

      toast({
        title: "Delegate added",
        description: "User has been granted access to this inbox.",
      });
      
      setSelectedUserId("");
      setRequireMFA(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error adding delegate",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleToggleMFA = async (delegationId: string, currentValue: boolean) => {
    try {
      const { error } = await (supabase
        .from("email_account_delegations") as any)
        .update({ requires_mfa: !currentValue })
        .eq("id", delegationId);

      if (error) throw error;

      // Optimistic update
      setDelegates(prev => prev.map(d => 
        d.id === delegationId ? { ...d, requires_mfa: !currentValue } : d
      ));

      toast({
        title: !currentValue ? "MFA Enabled" : "MFA Disabled",
        description: !currentValue 
          ? "This user will now be required to use MFA to access this inbox." 
          : "MFA requirement removed for this user.",
      });
    } catch (error: any) {
      toast({
        title: "Error updating settings",
        description: error.message,
        variant: "destructive",
      });
      fetchData(); // Revert on error
    }
  };

  const handleRemoveDelegate = async (delegationId: string) => {
    try {
      const { error } = await (supabase
        .from("email_account_delegations") as any)
        .delete()
        .eq("id", delegationId);

      if (error) throw error;

      toast({
        title: "Delegate removed",
        description: "User access has been revoked.",
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error removing delegate",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Inbox</DialogTitle>
          <DialogDescription>
            Grant other users access to {account?.email_address}. They will be able to read and send emails.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <Label>Add People</Label>
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-2">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={user.avatar_url} />
                            <AvatarFallback>{user.first_name?.[0]}{user.last_name?.[0]}</AvatarFallback>
                          </Avatar>
                          <span>{user.first_name} {user.last_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                    {availableUsers.length === 0 && (
                      <div className="p-2 text-sm text-muted-foreground text-center">No users available</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch 
                  id="new-mfa" 
                  checked={requireMFA} 
                  onCheckedChange={setRequireMFA} 
                />
                <Label htmlFor="new-mfa" className="cursor-pointer text-xs">Require MFA</Label>
              </div>
              <Button onClick={handleAddDelegate} disabled={!selectedUserId || adding}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <Label>Who has access</Label>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : delegates.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4 border rounded-md border-dashed">
                No one else has access to this inbox.
              </div>
            ) : (
              <div className="space-y-2">
                {delegates.map((delegate) => (
                  <div key={delegate.id} className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={delegate.user.avatar_url} />
                        <AvatarFallback>{delegate.user.first_name?.[0]}{delegate.user.last_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{delegate.user.first_name} {delegate.user.last_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{delegate.user.email}</span>
                          {delegate.requires_mfa && (
                            <Badge variant="outline" className="h-5 gap-1 bg-yellow-50 text-yellow-700 border-yellow-200">
                              <ShieldAlert className="h-3 w-3" /> MFA
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 mr-2">
                        <Switch 
                          checked={delegate.requires_mfa} 
                          onCheckedChange={(checked) => handleToggleMFA(delegate.id, !checked)} 
                        />
                        <span className="text-xs text-muted-foreground">MFA</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveDelegate(delegate.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
