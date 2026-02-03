
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, AlertTriangle, CheckCircle } from "lucide-react";
import { RestrictedPartyScreeningService, type ScreeningMatch } from "@/services/compliance/RestrictedPartyScreeningService";
import { toast } from "sonner";

interface ScreeningFormValues {
  name: string;
  country: string;
}

export default function RestrictedPartyScreening() {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<ScreeningMatch[] | null>(null);
  const [searchedName, setSearchedName] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<ScreeningFormValues>();

  const onSubmit = async (data: ScreeningFormValues) => {
    setLoading(true);
    setMatches(null);
    setSearchedName(data.name);
    try {
      const result = await RestrictedPartyScreeningService.screen({
        name: data.name,
        country: data.country || undefined,
        threshold: 0.5 // Default threshold
      });
      setMatches(result.matches);
      if (result.matches.length > 0) {
        toast.warning(`Found ${result.matches.length} potential matches.`);
      } else {
        toast.success("No matches found.");
      }
    } catch (error) {
      console.error("Screening error:", error);
      toast.error("Failed to perform screening. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Restricted Party Screening</h1>
        <p className="text-muted-foreground">
          Screen individuals and entities against global restricted party lists (DPL, EL, SDN, etc.).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Screening Search</CardTitle>
          <CardDescription>Enter the entity details to screen.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Entity Name</label>
              <Input 
                id="name" 
                placeholder="e.g. Huawei Technologies" 
                {...register("name", { required: true })} 
              />
              {errors.name && <span className="text-sm text-red-500">Name is required</span>}
            </div>
            <div className="flex-1 space-y-2">
              <label htmlFor="country" className="text-sm font-medium">Country (Optional)</label>
              <Input 
                id="country" 
                placeholder="e.g. CN or China" 
                {...register("country")} 
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Screen
            </Button>
          </form>
        </CardContent>
      </Card>

      {matches !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Screening Results for "{searchedName}"</CardTitle>
            <CardDescription>
              {matches.length === 0 
                ? "No matches found. This entity appears clear based on the provided information." 
                : `Found ${matches.length} potential matches. Please review carefully.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {matches.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-green-600">
                <CheckCircle className="mr-2 h-8 w-8" />
                <span className="text-lg font-medium">No Restricted Parties Found</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match Score</TableHead>
                    <TableHead>Entity Name</TableHead>
                    <TableHead>List Source</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match) => (
                    <TableRow key={match.id}>
                      <TableCell>
                        <Badge variant={match.similarity > 0.9 ? "destructive" : "secondary"}>
                          {(match.similarity * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{match.entity_name}</TableCell>
                      <TableCell>{match.source_list}</TableCell>
                      <TableCell>{match.address || '-'}</TableCell>
                      <TableCell>{match.country_code || '-'}</TableCell>
                      <TableCell className="max-w-md truncate" title={match.remarks}>
                        {match.remarks || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
