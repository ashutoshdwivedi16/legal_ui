import { useEffect, useRef, useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/shared/components/ui/table";
import { Download, EyeOff, Eye } from "lucide-react";
import { fetchFailures, ignoreAudit } from "./api";
import { downloadCSV } from "./utils";

const badgeColor = {
  CRITICAL: "bg-red-600 text-white",
  HIGH: "bg-orange-500 text-white",
  WARNING: "bg-yellow-400 text-black",
  MEDIUM: "bg-orange-400 text-white",
};

const FailureDrillDown: React.FC<{ jobId: string; onClose: () => void; onIgnoreSuccess?: () => void }> = ({ jobId, onClose, onIgnoreSuccess }) => {
  const [failures, setFailures] = useState<any[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [ignoringIds, setIgnoringIds] = useState<Record<string | number, boolean>>({});
  const ignoredCountRef = useRef(0);

  useEffect(() => {
    (async () => {
      const data = await fetchFailures(jobId);
      // The API now returns { failures: [...] } or an array
      setFailures(Array.isArray(data) ? data : (data?.failures ?? []));
    })();
  }, [jobId]);

  const handleIgnoreReasoning = async (auditId: string | number) => {
    setIgnoringIds((prev) => ({ ...prev, [auditId]: true }));
    try {
      await ignoreAudit(auditId, {
        ignore_reasoning: true,
        ignored_fields: ["llm_reasoning", "failed_rules"],
      });
      ignoredCountRef.current += 1;
      setFailures((prev) => prev.filter((item) => item.id !== auditId));
      onIgnoreSuccess?.();
    } catch (error) {
      console.error("Failed to ignore reasoning:", error);
      // Only re-enable the button on failure — on success the row is removed
      setIgnoringIds((prev) => ({ ...prev, [auditId]: false }));
    }
  };

  // Update scroll width whenever failures or expanded state changes
  useEffect(() => {
    const updateWidth = () => {
      if (scrollRef.current) {
        setScrollWidth(scrollRef.current.scrollWidth);
        setContainerWidth(scrollRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [failures, expandedIdx]);

  // Sync horizontal scrolling between the top floating scrollbar and the table container
  const handleScroll = (source: "top" | "bottom") => {
    if (!scrollRef.current || !topScrollRef.current) return;
    if (source === "top") {
      scrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    } else {
      topScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  };

  const handleClose = () => {
    if (ignoredCountRef.current > 0) {
      onIgnoreSuccess?.();
    }
    onClose();
  };

  const handleExportCSV = () => {
    if (failures.length === 0) return;

    const csvData = failures.map((f: any) => ({
      ID: f.id,
      "Content ID": f.content_id,
      "Content Type": f.content_type,
      "Input Text": f.input_text,
      "Violation Type": f.violation_type,
      "Compliance Score": f.compliance_score,
      Status: f.status,
      "Failed Rules": (f.failed_rules ?? []).join("; "),
      Reasoning: f.llm_reasoning,
      "Correction Hint": f.correction_hint,
      Source: f.source,
    }));

    downloadCSV(csvData, `failures_job_${jobId}.csv`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-[95vw] relative max-h-[92vh] overflow-hidden flex flex-col border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              Failure Drill-Down
              <span className="text-muted-foreground font-normal text-lg">Job #{jobId}</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Review and analyze compliance violations for this audit run</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={ handleExportCSV }
              disabled={ failures.length === 0 }
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              <Download className="size-3.5" />
              Export CSV
            </button>
            <div className="w-px h-8 bg-border mx-1" />
            <button
              className="rounded-full p-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              onClick={ handleClose }
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        {/* Floating Top Scrollbar (only visible if content overflows) */}
        <div
          ref={ topScrollRef }
          onScroll={ () => handleScroll("top") }
          className={ `overflow-x-auto overflow-y-hidden h-2.5 bg-muted/10 scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 transition-colors ${scrollWidth <= containerWidth ? "hidden" : "block"}` }
        >
          <div style={ { width: `${scrollWidth}px`, height: "1px" } }></div>
        </div>

        <div
          ref={ scrollRef }
          onScroll={ () => handleScroll("bottom") }
          className="flex-1 overflow-auto flex flex-col relative custom-scrollbar"
          id="scroll-container"
        >
          <Table className="w-full border-separate border-spacing-0">
            <TableHeader className="sticky top-0 bg-background z-20">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3 bg-muted/50 border-b border-r w-[70px]">ID</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3 bg-muted/50 border-b border-r w-[110px] text-center">Status</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3 bg-muted/50 border-b border-r w-[120px] text-center">Violation</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3 bg-muted/50 border-b border-r w-[80px] text-center">Score</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3 min-w-[260px] bg-muted/50 border-b border-r">Failed Rules</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3 min-w-[360px] bg-muted/50 border-b border-r">Reasoning</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground py-3 bg-muted/50 border-b w-[140px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {failures.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={ 7 } className="text-center py-20 text-muted-foreground italic bg-muted/5">
                    No failures reported for this job.
                  </TableCell>
                </TableRow>
              ) : (
                failures.map((item, idx) => (
                  <TableRow
                    key={ item.id || idx }
                    className={ `align-top border-b transition-colors ${ignoringIds[item.id] ? "bg-muted/50 opacity-60" : idx % 2 === 0 ? "bg-white hover:bg-muted/30" : "bg-gray-100 hover:bg-muted/30"}` }
                  >
                    <TableCell className="text-sm py-2 px-3 whitespace-nowrap font-mono font-medium text-muted-foreground border-r">
                      {item.id}
                    </TableCell>
                    <TableCell className="text-sm py-2 px-3 whitespace-nowrap border-r text-center">
                      <span className={ `font-bold px-2 py-0.5 rounded ${item.status === "FAIL" ? "text-red-600 bg-red-50" : item.status === "IGNORED" ? "text-muted-foreground bg-muted/60" : "text-green-600 bg-green-50"}` }>
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 px-3 border-r text-center">
                      <span className={ `px-2 py-0.5 rounded text-xs font-bold uppercase whitespace-nowrap shadow-sm border ${badgeColor[item.violation_type] || "bg-gray-100 text-gray-800 border-gray-200"}` }>
                        {item.violation_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm py-2 px-3 whitespace-nowrap border-r font-bold text-center">
                      {item.compliance_score}
                    </TableCell>
                    <TableCell className="py-2 px-3 border-r">
                      {item.failed_rules && item.failed_rules.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.failed_rules.map((rule: string) => (
                            <span key={ rule } className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100">
                              {rule}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-3 border-r">
                      <div className="text-sm leading-tight text-foreground font-medium">
                        {item.llm_reasoning?.split("\n").map((line: string, i: number) => (
                          <p key={ i } className={ line.trim().startsWith("[") ? "mt-1 first:mt-0" : "" }>
                            {line}
                          </p>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 px-3 text-center">
                      <button
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold transition-colors ${ignoringIds[item.id] ? "bg-amber-100 text-amber-700 border-amber-300 cursor-not-allowed" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                        onClick={() => handleIgnoreReasoning(item.id)}
                        disabled={ignoringIds[item.id]}
                        title="Ignore reasoning and failed rules"
                      >
                        {ignoringIds[item.id] ? (
                          <>
                            <span className="h-3 w-3 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                            Ignoring...
                          </>
                        ) : item.status === "IGNORED" ? (
                          <><EyeOff className="h-3 w-3" />Ignored</>
                        ) : (
                          <><Eye className="h-3 w-3" />Ignore</>
                        )}
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="px-6 py-3 border-t bg-muted/30 flex justify-between items-center text-xs text-muted-foreground">
          <p>Total Failures: <span className="font-bold text-foreground">{failures.length}</span></p>
          <p>Click &quot;Read More&quot; to expand long input text.</p>
        </div>
      </div>
    </div>
  );
};

export default FailureDrillDown;
