import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DomainVerificationService, TenantDomain } from "@/services/email/DomainVerificationService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RefreshCw, Plus, Trash2, Globe, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

export function DomainHealth() {
  const { roles, isPlatformAdmin } = useAuth();
  // Get tenant ID from the first role that has one. 
  // For platform admins operating in a specific context, this might need enhancement later.
  const tenantId = roles.find(r => r.tenant_id)?.tenant_id;
  const isAdmin = isPlatformAdmin();
  
  const [domains, setDomains] = useState<TenantDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // DNS Instructions State
  const [dnsDialogData, setDnsDialogData] = useState<{ domain: string; spf: string; dkim: any[]; dmarc: string } | null>(null);
  const [isDnsDialogOpen, setIsDnsDialogOpen] = useState(false);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const data = await DomainVerificationService.getDomains();
      // If tenant admin, filter by tenantId (though RLS should handle this)
      // If platform admin, show all? or filter by current context?
      // For now, rely on RLS/Service to return relevant domains.
      setDomains(data);
    } catch (error: any) {
      toast.error("Failed to load domains: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDomains();
  }, []);

  const handleVerify = async (domain: TenantDomain) => {
    try {
      setVerifying(domain.id);
      const result = await DomainVerificationService.verifyDomain(domain.id);
      
      if (result.success) {
        toast.success(`Verification completed for ${domain.domain_name}`);
        // Refresh list
        loadDomains();
      } else {
        toast.error(`Verification failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      toast.error("Verification error: " + error.message);
    } finally {
      setVerifying(null);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain) return;
    if (!tenantId) {
      toast.error("No tenant context found");
      return;
    }

    try {
      const result = await DomainVerificationService.addDomain(newDomain, tenantId);
      toast.success("Domain added successfully");
      setIsAddDialogOpen(false);
      setNewDomain("");
      
      // Show DNS instructions
      setDnsDialogData({
        domain: result.domain.domain_name,
        spf: result.instructions.spf,
        dkim: result.instructions.dkim,
        dmarc: result.instructions.dmarc
      });
      setIsDnsDialogOpen(true);
      
      loadDomains();
    } catch (error: any) {
      toast.error("Failed to add domain: " + error.message);
    }
  };

  const handleViewDns = (domain: TenantDomain) => {
    // Reconstruct instructions from metadata if available
    const metadata = domain.provider_metadata || {};
    const dkimTokens = metadata.dkim_tokens || [];
    
    const instructions = {
      spf: "v=spf1 include:amazonses.com ~all", // Default for AWS SES
      dkim: dkimTokens.map((t: string) => ({
        name: `${t}._domainkey.${domain.domain_name}`,
        type: "CNAME",
        value: `${t}.dkim.amazonses.com`
      })),
      dmarc: "v=DMARC1; p=none;"
    };

    setDnsDialogData({
      domain: domain.domain_name,
      spf: instructions.spf,
      dkim: instructions.dkim,
      dmarc: instructions.dmarc
    });
    setIsDnsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this domain?")) return;
    try {
      await DomainVerificationService.deleteDomain(id);
      toast.success("Domain deleted");
      loadDomains();
    } catch (error: any) {
      toast.error("Failed to delete domain: " + error.message);
    }
  };

  const StatusIcon = ({ verified }: { verified: boolean }) => {
    return verified ? (
      <CheckCircle2 className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Domain Health & Authentication
            </CardTitle>
            <CardDescription>
              Manage and verify your email sending domains (SPF, DKIM, DMARC) to ensure high deliverability.
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Domain</DialogTitle>
                <DialogDescription>
                  Enter the domain name you want to verify (e.g., example.com).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Domain Name</Label>
                  <Input 
                    placeholder="example.com" 
                    value={newDomain} 
                    onChange={(e) => setNewDomain(e.target.value)} 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddDomain}>Add Domain</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isDnsDialogOpen} onOpenChange={setIsDnsDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>DNS Configuration for {dnsDialogData?.domain}</DialogTitle>
                <DialogDescription>
                  Add these records to your DNS provider (e.g., GoDaddy, Cloudflare) to verify your domain.
                </DialogDescription>
              </DialogHeader>
              
              {dnsDialogData && (
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">DKIM (CNAME Records)</h3>
                    <div className="border rounded-md divide-y">
                      {dnsDialogData.dkim.map((record, i) => (
                        <div key={i} className="p-3 grid grid-cols-12 gap-4 text-sm">
                          <div className="col-span-5 font-mono break-all text-xs bg-muted p-2 rounded">{record.name}</div>
                          <div className="col-span-1 flex items-center justify-center text-muted-foreground">CNAME</div>
                          <div className="col-span-6 font-mono break-all text-xs bg-muted p-2 rounded">{record.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">SPF (TXT Record)</h3>
                    <div className="p-3 border rounded-md bg-muted font-mono text-xs break-all">
                      {dnsDialogData.spf}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">DMARC (TXT Record)</h3>
                    <div className="p-3 border rounded-md bg-muted font-mono text-xs break-all">
                      {dnsDialogData.dmarc}
                    </div>
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <Button onClick={() => setIsDnsDialogOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading domains...</div>
          ) : domains.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No domains configured.</p>
              <p className="text-sm">Add a domain to start verifying your email reputation.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead className="text-center">Verified</TableHead>
                  <TableHead className="text-center">SPF</TableHead>
                  <TableHead className="text-center">DKIM</TableHead>
                  <TableHead className="text-center">DMARC</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell className="font-medium">{domain.domain_name}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {domain.is_verified ? (
                          <Badge variant="default" className="bg-green-600">Verified</Badge>
                        ) : (
                          <Badge variant="destructive">Unverified</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center" title={domain.spf_record || "No record found"}>
                        <StatusIcon verified={domain.spf_verified} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center" title="Check provider metadata for details">
                        <StatusIcon verified={domain.dkim_verified} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center" title={domain.dmarc_record || "No record found"}>
                        <StatusIcon verified={domain.dmarc_verified} />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(domain.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewDns(domain)}
                        >
                          DNS
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleVerify(domain)}
                          disabled={verifying === domain.id || domain.is_verified}
                        >
                          {verifying === domain.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            "Verify"
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(domain.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Instructions / Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>DNS Configuration Guide</CardTitle>
          <CardDescription>Add these records to your DNS provider (GoDaddy, Cloudflare, etc.) to verify your domain.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">SPF Record <Badge variant="outline">TXT</Badge></h3>
              <p className="text-sm text-muted-foreground mb-2">Authorizes our servers to send email on your behalf.</p>
              <code className="block bg-muted p-2 rounded text-xs break-all">
                v=spf1 include:amazonses.com ~all
              </code>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">DMARC Record <Badge variant="outline">TXT</Badge></h3>
              <p className="text-sm text-muted-foreground mb-2">Polices what happens when authentication fails.</p>
              <code className="block bg-muted p-2 rounded text-xs break-all">
                v=DMARC1; p=none; rua=mailto:dmarc-reports@{domains[0]?.domain_name || "yourdomain.com"}
              </code>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">DKIM Record <Badge variant="outline">CNAME</Badge></h3>
              <p className="text-sm text-muted-foreground mb-2">Cryptographically signs your emails.</p>
              <p className="text-xs text-muted-foreground">Generated automatically. Check domain details after creation.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
