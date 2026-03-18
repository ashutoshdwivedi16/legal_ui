import { PlayCircle, History, Pencil, Trash2, Download } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/shared/components/ui/table";
import type { Project } from "./types";

export type ProjectTableRow = {
  id: string | number;
  name: string;
  passed: number;
  failed: number;
  ignored: number;
  compliance: number;
  timestamp?: string | number;
  project: Project;
};

interface ProjectTableProps {
  rows: ProjectTableRow[];
  onRunAudit: (projectId: string | number) => void;
  onRunAuditWithSources: (project: Project) => void;
  onViewHistory: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (projectId: string | number) => void;
  getComplianceStyle: (value: number) => string;
  formatTimestamp: (value?: string | number) => string;
  isRunningAudit: boolean;
  runningProjectId?: string | number | null;
  onViewFailures?: (jobId: string | number) => void;
  onExportFailures?: (jobId: string | number, projectName: string) => void;
}

export function ProjectTable({
  rows,
  onRunAudit,
  onRunAuditWithSources,
  onViewHistory,
  onEdit,
  onDelete,
  getComplianceStyle,
  formatTimestamp,
  isRunningAudit,
  runningProjectId,
  onViewFailures,
  onExportFailures,
}: ProjectTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
            <TableHead className="w-[35%] py-5 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Project Name</TableHead>
                <TableHead className="text-center py-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Status Metrics</TableHead>
                <TableHead className="text-center py-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Compliance</TableHead>
                <TableHead className="text-right py-5 px-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-20 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                    <History className="size-6 opacity-20" />
                  </div>
                  <p className="text-lg font-medium">No projects found</p>
                  <p className="text-sm opacity-70">Add a new project to start monitoring compliance</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} className="group hover:bg-muted/30 transition-all border-b last:border-0">
                <TableCell className="py-5 px-6">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-base font-bold text-foreground group-hover:text-primary transition-colors">{row.name}</span>
                    {row.timestamp && (
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mt-1">
                        <span className="size-1.5 rounded-full bg-border" />
                        Last audit: {formatTimestamp(row.timestamp)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-5 text-center">
                  <div className="flex items-center justify-center gap-6">
                    <div className="flex flex-col items-center">
                      <span className="text-xl font-black text-success tabular-nums">{row.passed}</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Passed</span>
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <button
                      onClick={() => {
                        const jobId = row.project.jobs?.[0]?.job_id;
                        if (jobId && onViewFailures) onViewFailures(jobId);
                      }}
                      className={`flex flex-col items-center hover:scale-110 transition-transform ${
                        row.failed > 0 && onViewFailures ? "cursor-pointer" : "cursor-default"
                      }`}
                      disabled={row.failed === 0 || !onViewFailures}
                    >
                      <span className={`text-xl font-black tabular-nums ${row.failed > 0 ? 'text-destructive' : 'text-muted-foreground opacity-40'}`}>
                        {row.failed}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Failed</span>
                    </button>
                    <div className="w-px h-8 bg-border" />
                    <div className="flex flex-col items-center">
                      <span className="text-xl font-black tabular-nums text-muted-foreground">{row.ignored}</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Ignored</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-5 text-center">
                  <div className="flex items-center justify-center">
                    <div
                      className={`inline-flex size-14 items-center justify-center rounded-2xl border-2 text-sm font-black shadow-inner transition-all group-hover:scale-105 ${getComplianceStyle(
                        row.compliance
                      )}`}
                    >
                      {row.compliance}%
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-5 px-6">
                  <div className="flex items-center justify-end gap-2">
                    {(() => {
                      const hasSources =
                        Array.isArray(row.project.data_sources) && row.project.data_sources.length > 0;
                      return (
                    <Button
                      title="Run Audit"
                      size="sm"
                      className="h-9 px-3 text-xs gap-1.5 font-bold shadow-sm transition-all hover:scale-105"
                      onClick={() => onRunAudit(row.id)}
                      disabled={isRunningAudit}
                    >
                      <PlayCircle className={`size-4 ${isRunningAudit && runningProjectId === row.id ? 'animate-spin' : ''}`} />
                      <span>{isRunningAudit && runningProjectId === row.id ? 'Running...' : 'Run'}</span>
                    </Button>
                    <Button
                      title="Run With Sources"
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 text-xs gap-1.5 font-bold border-border bg-background/50 backdrop-blur-sm transition-all hover:bg-muted"
                      onClick={() => onRunAuditWithSources(row.project)}
                      disabled={isRunningAudit || !hasSources}
                    >
                      <PlayCircle className="size-4" />
                      <span>Run w/ Sources</span>
                    </Button>
                      );
                    })()}
                    <Button
                      title="View History"
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 text-xs gap-1.5 font-bold border-border bg-background/50 backdrop-blur-sm transition-all hover:bg-muted"
                      onClick={() => onViewHistory(row.project)}
                    >
                      <History className="size-4" />
                      <span>History</span>
                    </Button>
                    <Button
                      title="Export Failures to CSV"
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 text-xs gap-1.5 font-bold border-border bg-background/50 backdrop-blur-sm transition-all hover:bg-muted"
                      onClick={() => {
                        const jobId = row.project.jobs?.[0]?.job_id;
                        if (jobId && onExportFailures) onExportFailures(jobId, row.name);
                      }}
                      disabled={row.failed === 0 || !onExportFailures}
                    >
                      <Download className="size-4" />
                      <span>Export CSV</span>
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <Button
                      title="Edit Project"
                      size="icon"
                      variant="ghost"
                      className="size-9 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => onEdit(row.project)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      title="Delete Project"
                      size="icon"
                      variant="ghost"
                      className="size-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onDelete(row.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
