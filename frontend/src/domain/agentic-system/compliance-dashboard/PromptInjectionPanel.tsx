import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Play, RotateCcw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { 
  fetchProjects,
  fetchPromptInjectionCases, 
  fetchPromptInjectionResults, 
  fetchPromptInjectionRuns, 
  fetchPromptInjectionRunDetails,
  runPromptInjection,
  createPromptInjectionCase,
  updatePromptInjectionCase,
  deletePromptInjectionCase
} from "./api";
import type { PromptInjectionCase, PromptInjectionResult, PromptInjectionRun } from "./prompt-injection-types";
import { formatTimestamp } from "./utils";

function getSeverityBadge(severity: string) {
  switch (severity?.toLowerCase()) {
    case "critical":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "high":
      return "bg-orange-500/10 text-orange-500 border-orange-500/30";
    case "medium":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
    default:
      return "bg-muted text-foreground border-border";
  }
}

export function PromptInjectionPanel() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<PromptInjectionResult | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<PromptInjectionCase | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formSeverity, setFormSeverity] = useState("MEDIUM");
  const [formTarget, setFormTarget] = useState("");
  const [formType, setFormType] = useState("");
  const [formExpected, setFormExpected] = useState("BLOCK");
  const [formApplication, setFormApplication] = useState("");
  const [formAttackText, setFormAttackText] = useState("");
  const [formMessagesJson, setFormMessagesJson] = useState("");
  const [formTagsJson, setFormTagsJson] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [isCustomTarget, setIsCustomTarget] = useState(false);
  const [isCustomType, setIsCustomType] = useState(false);
  const [isCustomApplication, setIsCustomApplication] = useState(false);
  const queryClient = useQueryClient();

  const targetOptions = ["system_prompt", "content"];
  const typeOptions = [
    "jailbreak",
    "prompt_leakage",
    "instruction_injection",
    "data_exfiltration",
    "policy_bypass",
  ];

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const { data: runs = [], isLoading: isLoadingRuns } = useQuery<PromptInjectionRun[]>({
    queryKey: ["prompt-injection-runs", selectedProjectId],
    queryFn: () => fetchPromptInjectionRuns(selectedProjectId ?? undefined),
    enabled: !!selectedProjectId,
  });

  const activeRunId = selectedRunId;

  const { data: activeRun, isFetching: isFetchingRun } = useQuery<PromptInjectionRun | null>({
    queryKey: ["prompt-injection-run", activeRunId, selectedProjectId],
    queryFn: () =>
      activeRunId ? fetchPromptInjectionRunDetails(activeRunId, selectedProjectId ?? undefined) : Promise.resolve(null),
    enabled: !!activeRunId && !!selectedProjectId,
  });

  const { data: cases = [] } = useQuery<PromptInjectionCase[]>({
    queryKey: ["prompt-injection-cases", selectedProjectId],
    queryFn: () => fetchPromptInjectionCases(selectedProjectId ?? undefined),
    enabled: !!selectedProjectId,
  });

  const { data: results = [], isFetching: isFetchingResults } = useQuery<PromptInjectionResult[]>({
    queryKey: ["prompt-injection-results", activeRunId, selectedProjectId],
    queryFn: () =>
      activeRunId
        ? fetchPromptInjectionResults(activeRunId, selectedProjectId ?? undefined)
        : Promise.resolve([]),
    enabled: !!activeRunId && !!selectedProjectId,
  });

  useEffect(() => {
    setSelectedRunId(null);
    setSelectedResult(null);
  }, [selectedProjectId]);

  const runMutation = useMutation({
    mutationFn: () => runPromptInjection(selectedProjectId ?? undefined),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["prompt-injection-runs", selectedProjectId] });
      if (data?.run_id) {
        setSelectedRunId(data.run_id);
      }
    },
  });

  const createCaseMutation = useMutation({
    mutationFn: (payload: Partial<PromptInjectionCase>) =>
      createPromptInjectionCase(payload, selectedProjectId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompt-injection-cases", selectedProjectId] });
      setIsCaseModalOpen(false);
    },
  });

  const updateCaseMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PromptInjectionCase> }) =>
      updatePromptInjectionCase(id, payload, selectedProjectId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompt-injection-cases", selectedProjectId] });
      setIsCaseModalOpen(false);
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: (id: string) => deletePromptInjectionCase(id, selectedProjectId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompt-injection-cases", selectedProjectId] });
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["prompt-injection-runs", selectedProjectId] });
    if (activeRunId) {
      queryClient.invalidateQueries({ queryKey: ["prompt-injection-run", activeRunId, selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ["prompt-injection-results", activeRunId, selectedProjectId] });
    }
  };

  const summary = useMemo(() => {
    const totalCases = activeRun?.total_cases ?? activeRun?.summary?.total_cases ?? activeRun?.summary?.total;
    
    if (activeRun?.summary) {
      return {
        total: totalCases ?? 0,
        passed: activeRun.summary.passed ?? 0,
        failed: activeRun.summary.failed ?? 0
      };
    }
    
    const passed = results.filter((result) => result.passed).length;
    const total = results.length;
    const failed = total - passed;
    
    return { 
      total: totalCases ?? total, 
      passed, 
      failed 
    };
  }, [results, activeRun]);

  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => {
      const dateA = new Date(a.started_at || 0).getTime();
      const dateB = new Date(b.started_at || 0).getTime();
      return dateB - dateA;
    });
  }, [runs]);

  const caseLookup = useMemo(() => {
    return cases.reduce<Record<string, PromptInjectionCase>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [cases]);

  const hasActiveRun = useMemo(() => {
    return runs.some(run => !run.completed_at && !(run.summary && (run.summary.total ?? 0) > 0));
  }, [runs]);

  const openCreateCase = () => {
    setEditingCase(null);
    setFormTitle("");
    setFormSeverity("MEDIUM");
    setFormTarget("");
    setFormType("");
    setFormExpected("BLOCK");
    setFormApplication("");
    setFormAttackText("");
    setFormMessagesJson("");
    setFormTagsJson("");
    setFormIsActive(true);
    setIsCustomTarget(true);
    setIsCustomType(true);
    setIsCustomApplication(true);
    setIsCaseModalOpen(true);
  };

  const openEditCase = (item: PromptInjectionCase) => {
    const projectNames = projects.map((project: any) => project.project_name ?? project.name ?? String(project.id));
    setEditingCase(item);
    setFormTitle(item.title ?? "");
    setFormSeverity(item.severity ?? "MEDIUM");
    setFormTarget(item.target ?? "");
    setFormType(item.type ?? "");
    setFormExpected(item.expected ?? "BLOCK");
    setFormApplication(item.application_name ?? "");
    setFormAttackText(item.attack_text ?? "");
    setFormMessagesJson(item.messages ? JSON.stringify(item.messages, null, 2) : "");
    setFormTagsJson(item.tags ? JSON.stringify(item.tags, null, 2) : "");
    setFormIsActive(item.is_active ?? true);
    setIsCustomTarget(item.target ? !targetOptions.includes(item.target) : true);
    setIsCustomType(item.type ? !typeOptions.includes(item.type) : true);
    setIsCustomApplication(
      item.application_name ? !projectNames.includes(item.application_name) : true
    );
    setIsCaseModalOpen(true);
  };

  const handleSaveCase = () => {
    if (!formTitle.trim()) return;
    if (!selectedProjectId) {
      alert("Please select a project before saving a case.");
      return;
    }
    let messages: unknown = undefined;
    let tags: unknown = undefined;
    if (formMessagesJson.trim()) {
      try {
        messages = JSON.parse(formMessagesJson);
      } catch {
        alert("Messages JSON is invalid.");
        return;
      }
    }
    if (formTagsJson.trim()) {
      try {
        tags = JSON.parse(formTagsJson);
      } catch {
        alert("Tags JSON is invalid.");
        return;
      }
    }
    const payload: Partial<PromptInjectionCase> = {
      title: formTitle.trim(),
      severity: formSeverity,
      target: formTarget || undefined,
      type: formType || undefined,
      expected: formExpected || undefined,
      application_name: formApplication || undefined,
      attack_text: formAttackText || undefined,
      messages: messages as any,
      tags: tags as any,
      is_active: formIsActive,
    };
    if (editingCase?.id) {
      updateCaseMutation.mutate({ id: editingCase.id, payload });
    } else {
      createCaseMutation.mutate(payload);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Prompt Injection Dashboard</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Project</label>
            <Select
              value={selectedProjectId ?? ""}
              onValueChange={(value) => setSelectedProjectId(value)}
            >
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project: any) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.project_name ?? project.name ?? project.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openCreateCase} disabled={!selectedProjectId}>
            Add Case
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={!selectedProjectId || isLoadingRuns || isFetchingRun || isFetchingResults}
          >
            <RotateCcw className={`mr-2 h-4 w-4 ${(isFetchingRun || isFetchingResults) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div title={hasActiveRun ? "A test run is already in progress" : ""}>
            <Button 
              size="sm" 
              onClick={() => runMutation.mutate()}
              disabled={!selectedProjectId || runMutation.isPending || hasActiveRun}
            >
              <Play className="mr-2 h-4 w-4" />
              {runMutation.isPending ? "Running..." : hasActiveRun ? "Run in Progress" : "Run Test"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs uppercase text-muted-foreground">Total Cases</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs uppercase text-muted-foreground">Passed</p>
          <p className="mt-2 text-2xl font-semibold text-success">{summary.passed}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs uppercase text-muted-foreground">Failed</p>
          <p className="mt-2 text-2xl font-semibold text-destructive">{summary.failed}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="rounded-lg border border-border bg-background">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Runs</h3>
            <p className="text-xs text-muted-foreground">Select a run to view results.</p>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {!selectedProjectId ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Select a project to view runs.</p>
            ) : sortedRuns.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No runs available.</p>
            ) : (
              sortedRuns.map((run) => {
                const isActive = run.run_id === activeRunId;
                const isRunComplete = Boolean(run.completed_at || (run.summary && (run.summary.total ?? 0) > 0));
                return (
                  <button
                    key={run.run_id}
                    onClick={() => setSelectedRunId(run.run_id)}
                    className={`flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left transition hover:bg-muted/40 ${
                      isActive ? "bg-muted/40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{run.run_id}</span>
                      {!isRunComplete && (
                        <Badge variant="outline" className="animate-pulse bg-blue-500/10 text-blue-500 border-blue-500/30 text-[10px] h-4 px-1">
                          Running
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(run.completed_at || run.started_at)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {run.model_name || "Model"} · {run.rules_version || "Rules"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background flex flex-col max-h-[520px]">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Results</h3>
            <p className="text-xs text-muted-foreground">Prompt injection test outcomes.</p>
          </div>
          <div className="p-4 overflow-y-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!activeRunId ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      Select a run to view results.
                    </TableCell>
                  </TableRow>
                ) : results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      No results for this run.
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((result) => {
                    const caseData = caseLookup[result.case_id];
                    return (
                      <TableRow key={result.result_id}>
                        <TableCell className="py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">
                              {caseData?.title || result.case_id}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(result.created_at)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge className={getSeverityBadge(result.severity)} variant="outline">
                            {result.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            className={
                              result.passed
                                ? "bg-success/10 text-success border-success/30"
                                : "bg-destructive/10 text-destructive border-destructive/30"
                            }
                            variant="outline"
                          >
                            {result.passed ? "Passed" : "Failed"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-foreground">{result.target}</TableCell>
                        <TableCell className="py-3 text-sm text-foreground">{result.type}</TableCell>
                        <TableCell className="py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelectedResult(result)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <div className="border-b border-border px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Cases</h3>
            <p className="text-xs text-muted-foreground">Manage prompt injection cases.</p>
          </div>
        </div>
        <div className="p-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!selectedProjectId ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    Select a project to manage cases.
                  </TableCell>
                </TableRow>
              ) : cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    No cases found.
                  </TableCell>
                </TableRow>
              ) : (
                cases.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{item.title}</TableCell>
                    <TableCell>
                      <Badge className={getSeverityBadge(item.severity)} variant="outline">
                        {item.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.is_active ? "Active" : "Inactive"}
                    </TableCell>
                    <TableCell className="text-sm">{item.target}</TableCell>
                    <TableCell className="text-sm">{item.type}</TableCell>
                    <TableCell className="space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openEditCase(item)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteCaseMutation.mutate(item.id)}
                        disabled={deleteCaseMutation.isPending}
                      >
                        Disable
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={Boolean(selectedResult)} onOpenChange={(open) => !open && setSelectedResult(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prompt Injection Details</DialogTitle>
            <DialogDescription>Case and result details for the selected run.</DialogDescription>
          </DialogHeader>
          {selectedResult ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs uppercase text-muted-foreground">Case</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {caseLookup[selectedResult.case_id]?.title || selectedResult.case_id}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {caseLookup[selectedResult.case_id]?.attack_text}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs uppercase text-muted-foreground">Expected</p>
                  <p className="mt-2 text-sm text-foreground">{selectedResult.expected}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs uppercase text-muted-foreground">Actual</p>
                  <p className="mt-2 text-sm text-foreground">{selectedResult.actual}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={getSeverityBadge(selectedResult.severity)} variant="outline">
                  {selectedResult.severity}
                </Badge>
                <Badge variant="outline">{selectedResult.type}</Badge>
                <Badge variant="outline">{selectedResult.target}</Badge>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isCaseModalOpen} onOpenChange={setIsCaseModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingCase ? "Edit Case" : "Add Case"}</DialogTitle>
            <DialogDescription>Manage prompt injection test cases.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Title</label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground">Severity</label>
                <Select value={formSeverity} onValueChange={setFormSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["CRITICAL","HIGH","MEDIUM","LOW"].map((level) => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Status</label>
                <Select value={formIsActive ? "active" : "inactive"} onValueChange={(v) => setFormIsActive(v === "active")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground">Target</label>
                <Select
                  value={isCustomTarget ? "__custom__" : formTarget}
                  onValueChange={(value) => {
                    if (value === "__custom__") {
                      setIsCustomTarget(true);
                      setFormTarget("");
                    } else {
                      setIsCustomTarget(false);
                      setFormTarget(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {isCustomTarget && (
                  <Input
                    className="mt-2"
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    placeholder="Enter custom target"
                  />
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Type</label>
                <Select
                  value={isCustomType ? "__custom__" : formType}
                  onValueChange={(value) => {
                    if (value === "__custom__") {
                      setIsCustomType(true);
                      setFormType("");
                    } else {
                      setIsCustomType(false);
                      setFormType(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {isCustomType && (
                  <Input
                    className="mt-2"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    placeholder="Enter custom type"
                  />
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground">Expected</label>
                <Select value={formExpected} onValueChange={setFormExpected}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["BLOCK","ALLOW"].map((val) => (
                      <SelectItem key={val} value={val}>{val}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Application</label>
                <Select
                  value={isCustomApplication ? "__custom__" : formApplication}
                  onValueChange={(value) => {
                    if (value === "__custom__") {
                      setIsCustomApplication(true);
                      setFormApplication("");
                    } else {
                      setIsCustomApplication(false);
                      setFormApplication(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select application" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project: any) => (
                      <SelectItem key={project.id} value={project.project_name ?? String(project.id)}>
                        {project.project_name ?? project.name ?? project.id}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {isCustomApplication && (
                  <Input
                    className="mt-2"
                    value={formApplication}
                    onChange={(e) => setFormApplication(e.target.value)}
                    placeholder="Enter application"
                  />
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Attack Text</label>
              <Textarea value={formAttackText} onChange={(e) => setFormAttackText(e.target.value)} rows={4} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Messages (JSON)</label>
              <Textarea value={formMessagesJson} onChange={(e) => setFormMessagesJson(e.target.value)} rows={4} placeholder='[{"role":"user","content":"..."}]' />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Tags (JSON)</label>
              <Textarea value={formTagsJson} onChange={(e) => setFormTagsJson(e.target.value)} rows={3} placeholder='["tag1","tag2"]' />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsCaseModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCase} disabled={!formTitle.trim() || createCaseMutation.isPending || updateCaseMutation.isPending}>
              {editingCase ? "Save" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
