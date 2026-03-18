import { useQuery } from "@tanstack/react-query";
import { fetchComplianceRules } from "./api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";

export function LegalRulesPanel() {
  const { data: rules = [], isLoading, isError } = useQuery({
    queryKey: ["compliance-rules"],
    queryFn: fetchComplianceRules,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading rules...</div>;
  }

  if (isError) {
    return <div className="text-sm text-destructive">Failed to load rules.</div>;
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
            <TableHead className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Rule</TableHead>
            <TableHead className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Category</TableHead>
            <TableHead className="py-4 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                No legal rules available.
              </TableCell>
            </TableRow>
          ) : (
            rules.map((rule: any, idx: number) => (
              <TableRow key={rule.id ?? idx} className="border-b last:border-0">
                <TableCell className="py-4 px-6 text-sm font-medium text-foreground">
                  {rule.name ?? rule.rule_name ?? rule.id ?? `Rule ${idx + 1}`}
                </TableCell>
                <TableCell className="py-4 px-6 text-sm text-muted-foreground">
                  {rule.category ?? rule.group ?? "-"}
                </TableCell>
                <TableCell className="py-4 px-6 text-sm text-muted-foreground">
                  {rule.description ?? rule.summary ?? "-"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
