import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import type { AuditRun } from "./types";
import { formatTimestamp } from "./utils";

interface HistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName?: string;
  projectRuns: AuditRun[];
  onViewFailures?: (jobId: string | number) => void;
}

export function HistoryModal({
  open,
  onOpenChange,
  projectName,
  projectRuns,
  onViewFailures,
}: HistoryModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-2xl font-bold">{projectName || "Audit"}</DialogTitle>
          <DialogDescription className="text-base">Audit History - Last 10 Runs</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2 mt-4 custom-scrollbar">
          {projectRuns.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              No audit runs found for this project
            </p>
          ) : (
            <div className="space-y-3">
              {projectRuns.slice(0, 10).map((run, index) => (
                <AuditRunItem
                  key={run.id}
                  run={run}
                  index={index}
                  onViewFailures={onViewFailures}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AuditRunItem({
  run,
  index,
  onViewFailures,
}: {
  run: AuditRun;
  index: number;
  onViewFailures?: (jobId: string | number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card transition-all hover:shadow-md">
      <div className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/30 group">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center justify-center size-10 rounded-full bg-muted text-muted-foreground font-bold text-sm">
            #{run.id}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {formatTimestamp(run.timestamp)}
            </p>
            <div className="mt-1.5 flex items-center gap-2.5">
              {run.failed === 0 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2.5 py-1 text-xs font-bold text-success border border-success/20 cursor-default">
                      <span className="size-1.5 rounded-full bg-success"></span>
                      ✓ {run.passed} Passed
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    All tests passed successfully
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2.5 py-1 text-xs font-bold text-success border border-success/20">
                  <span className="size-1.5 rounded-full bg-success"></span>
                  ✓ {run.passed}
                </span>
              )}
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (run.failed > 0 && onViewFailures) {
                    onViewFailures(run.id);
                  }
                }}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-all border ${
                  run.failed > 0 && onViewFailures 
                    ? "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 cursor-pointer" 
                    : "bg-muted text-muted-foreground border-transparent cursor-default opacity-60"
                }`}
                disabled={run.failed === 0 || !onViewFailures}
              >
                {run.failed > 0 && <span className="size-1.5 rounded-full bg-destructive animate-pulse"></span>}
                ✗ {run.failed} {run.failed === 1 ? 'Failure' : 'Failures'}
              </button>
            </div>
          </div>
        </div>
        
        {run.failed > 0 && onViewFailures && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs font-medium text-blue-500 hover:text-blue-600 hover:bg-blue-50"
            onClick={() => onViewFailures(run.id)}
          >
            View Details
          </Button>
        )}
      </div>
    </div>
  );
}
