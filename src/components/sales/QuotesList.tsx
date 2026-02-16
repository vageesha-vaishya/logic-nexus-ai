import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Quote, statusConfig } from "@/pages/dashboard/quotes-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";

interface QuotesListProps {
  quotes: Quote[];
  selectedQuotes: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  bulkMode: boolean;
}

export function QuotesList({
  quotes,
  selectedQuotes,
  onToggleSelection,
  onSelectAll,
  bulkMode,
}: QuotesListProps) {
  const navigate = useNavigate();

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {bulkMode && (
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={quotes.length > 0 && selectedQuotes.size === quotes.length}
                  onCheckedChange={(checked) => onSelectAll(!!checked)}
                />
              </TableHead>
            )}
            <TableHead className="w-[100px]">Quote #</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="text-right">Margin</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={bulkMode ? 9 : 8} className="h-24 text-center">
                No quotes found.
              </TableCell>
            </TableRow>
          ) : (
            quotes.map((quote) => (
              <TableRow key={quote.id}>
                {bulkMode && (
                  <TableCell>
                    <Checkbox
                      checked={selectedQuotes.has(quote.id)}
                      onCheckedChange={() => onToggleSelection(quote.id)}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  <Button 
                    variant="link" 
                    className="p-0 h-auto font-medium" 
                    onClick={() => navigate(`/dashboard/quotes/${quote.id}`)}
                  >
                    {quote.quote_number}
                  </Button>
                </TableCell>
                <TableCell>{quote.accounts?.name || '-'}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={quote.title || ''}>
                  {quote.title || '-'}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="secondary" 
                    className={`${(statusConfig[quote.status as keyof typeof statusConfig] || { color: 'bg-gray-100 text-gray-800' }).color} hover:bg-opacity-80`}
                  >
                    {(statusConfig[quote.status as keyof typeof statusConfig] || { label: quote.status }).label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(quote.sell_price)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {quote.margin_percentage !== null && quote.margin_percentage !== undefined ? `${Math.round(quote.margin_percentage)}%` : '-'}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => navigate(`/dashboard/quotes/${quote.id}`)}>
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/dashboard/quotes/${quote.id}/edit`)}>
                        Edit Quote
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        Delete Quote
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
