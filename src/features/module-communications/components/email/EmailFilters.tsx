import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Filter, Edit, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function EmailFilters() {
  const [filters, setFilters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchFilters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("email_filters")
        .select("*")
        .order("priority", { ascending: false });

      if (error) throw error;
      setFilters(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  const toggleFilter = async (filterId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("email_filters")
        .update({ is_active: !isActive })
        .eq("id", filterId);

      if (error) throw error;
      fetchFilters();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Filters</h2>
          <p className="text-muted-foreground">
            Automatically organize and manage your emails
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Filter
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Loading filters...
          </CardContent>
        </Card>
      ) : filters.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Filter className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">No email filters configured</p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Filter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filters.map((filter) => (
            <Card key={filter.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{filter.name}</CardTitle>
                      <Badge variant={filter.is_active ? "default" : "secondary"}>
                        {filter.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">Priority: {filter.priority}</Badge>
                    </div>
                    {filter.description && (
                      <p className="text-sm text-muted-foreground">{filter.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleFilter(filter.id, filter.is_active)}
                    >
                      {filter.is_active ? (
                        <ToggleRight className="w-4 h-4" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
