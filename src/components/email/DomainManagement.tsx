import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Copy } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Domain = {
  id: string;
  domain_name: string;
  is_verified: boolean;
  spf_verified: boolean;
  dkim_verified: boolean;
  dmarc_verified: boolean;
  provider_metadata: any;
  created_at: string;
};

export function DomainManagement() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      const { data, error } = await supabase
        .from("tenant_domains")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDomains(data || []);
    } catch (error: any) {
      console.error("Error fetching domains:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!newDomain) return;
    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke("domains-register", {
        body: { domain_name: newDomain },
      });

      if (error) throw error;
      if (data && data.error) throw new Error(data.error);

      toast({
        title: "Domain registered",
        description: "Please configure your DNS records.",
      });
      setOpen(false);
      setNewDomain("");
      fetchDomains();
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleVerify = async (id: string) => {
    setVerifying(id);
    try {
      const { data, error } = await supabase.functions.invoke("domains-verify", {
        body: { domain_id: id },
      });

      if (error) throw error;
      if (data && data.error) throw new Error(data.error);

      toast({
        title: "Verification completed",
        description: `Status: SPF=${data.results.spf ? 'OK' : 'Fail'}, DKIM=${data.results.dkim ? 'OK' : 'Fail'}, DMARC=${data.results.dmarc ? 'OK' : 'Fail'}`,
      });
      fetchDomains();
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setVerifying(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                <CardTitle>Domain Management</CardTitle>
                <CardDescription>Manage your email sending domains and authentication.</CardDescription>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button>Add Domain</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Register New Domain</DialogTitle>
                        <DialogDescription>
                            Enter the domain you want to send emails from (e.g., mycompany.com).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Input 
                            placeholder="example.com" 
                            value={newDomain} 
                            onChange={(e) => setNewDomain(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleRegister} disabled={registering}>
                        {registering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Register
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
            <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : domains.length === 0 ? (
            <div className="text-center p-4 text-muted-foreground">No domains configured.</div>
        ) : (
            <div className="space-y-6">
                {domains.map(domain => (
                    <div key={domain.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    {domain.domain_name}
                                    {domain.is_verified ? (
                                        <Badge variant="default" className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="h-3 w-3 mr-1" /> Verified</Badge>
                                    ) : (
                                        <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Unverified</Badge>
                                    )}
                                </h3>
                                <p className="text-sm text-muted-foreground">Created on {new Date(domain.created_at).toLocaleDateString()}</p>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleVerify(domain.id)}
                                disabled={verifying === domain.id}
                            >
                                {verifying === domain.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                Verify DNS
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 mb-4">
                             <div className="flex items-center gap-2 text-sm">
                                <span className={domain.spf_verified ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                                    {domain.spf_verified ? <CheckCircle2 className="h-4 w-4 inline mr-1" /> : <XCircle className="h-4 w-4 inline mr-1" />} SPF
                                </span>
                             </div>
                             <div className="flex items-center gap-2 text-sm">
                                <span className={domain.dkim_verified ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                                    {domain.dkim_verified ? <CheckCircle2 className="h-4 w-4 inline mr-1" /> : <XCircle className="h-4 w-4 inline mr-1" />} DKIM
                                </span>
                             </div>
                             <div className="flex items-center gap-2 text-sm">
                                <span className={domain.dmarc_verified ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                                    {domain.dmarc_verified ? <CheckCircle2 className="h-4 w-4 inline mr-1" /> : <XCircle className="h-4 w-4 inline mr-1" />} DMARC
                                </span>
                             </div>
                        </div>

                        {!domain.is_verified && domain.provider_metadata?.dkim_tokens && (
                            <div className="bg-muted p-3 rounded-md text-sm">
                                <p className="font-medium mb-2">DNS Configuration Required:</p>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[100px]">Type</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Value</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(domain.provider_metadata.dkim_tokens as string[]).map((token, i) => (
                                            <TableRow key={i}>
                                                <TableCell>CNAME</TableCell>
                                                <TableCell className="font-mono text-xs">{token}._domainkey</TableCell>
                                                <TableCell className="font-mono text-xs">{token}.dkim.amazonses.com</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(`${token}._domainkey`)}>
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
