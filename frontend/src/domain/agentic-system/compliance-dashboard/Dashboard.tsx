import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, FlaskConical } from "lucide-react";

import {
  fetchProjects,
  runAuditJob,
  runAuditJobWithSources,
  createProject,
  deleteProject,
  updateProject,
  fetchFailures,
  uploadProjectRulesFile,
} from "./api";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { ProjectModal } from "./ProjectModal";
import { HistoryModal } from "./HistoryModal";
import { ProjectTable } from "./ProjectTable";
import { PromptInjectionPanel } from "./PromptInjectionPanel";
import { LegalRulesPanel } from "./LegalRulesPanel";
import { PostmanRequestModal } from "./PostmanRequestModal";
import FailureDrillDown from "./FailureDrillDown";
import type { Project, AuditRun } from "./types";
import type { DataSource } from "./DataSourceEditor";
import { calculateCompliance, formatTimestamp, downloadCSV } from "./utils";

type DashboardProps = {
  projectsList?: Array<{
    id: string | number;
    name: string;
    description?: string;
  }>;
};

// Compliance Dashboard
const Dashboard: React.FC<DashboardProps> = ({ projectsList }) => {
  const [activeTab, setActiveTab] = useState<"compliance" | "prompt-injection" | "legal-rules">("compliance");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | number | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formRulesMode, setFormRulesMode] = useState<"global" | "project" | "global+project">("global");
  const [formRulesUri, setFormRulesUri] = useState("");
  const [formRulesFile, setFormRulesFile] = useState<File | null>(null);
  const [rulesUploadStatus, setRulesUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [rulesUploadError, setRulesUploadError] = useState("");
  const [formUrls, setFormUrls] = useState("");
  const [formDataSources, setFormDataSources] = useState<DataSource[]>([]);
  const [drillDownJobId, setDrillDownJobId] = useState<string | number | null>(null);
  const [isPostmanModalOpen, setIsPostmanModalOpen] = useState(false);
  const [postmanProjectId, setPostmanProjectId] = useState<string | number | null>(null);
  const [isRunWithSourcesOpen, setIsRunWithSourcesOpen] = useState(false);
  const [runWithSourcesProject, setRunWithSourcesProject] = useState<Project | null>(null);
  const [runWithSourcesJson, setRunWithSourcesJson] = useState("[]");

  const [runningProjectId, setRunningProjectId] = useState<string | number | null>(null);

  const { data: projects = [], refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const runAudit = useMutation({
    mutationFn: runAuditJob,
    onSuccess: () => {
      refetch();
      setRunningProjectId(null);
    },
    onError: () => {
      setRunningProjectId(null);
    }
  });

  const handleRunAudit = (projectId: string | number) => {
    setRunningProjectId(projectId);
    runAudit.mutate(String(projectId));
  };

  const handleRunAuditWithSources = async (project: Project) => {
    setRunWithSourcesProject(project);
    setRunWithSourcesJson("[]");
    setIsRunWithSourcesOpen(true);
  };

  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      refetch();
      setIsProjectModalOpen(false);
      resetProjectForm();
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string | number;
      payload: {
        project_name: string;
        project_description: string;
        project_prompt?: string;
        rules_mode?: "global" | "project" | "global+project";
        rules_uri?: string | null;
        data_sources?: DataSource[];
      };
    }) => updateProject(id, payload),
    onSuccess: () => {
      refetch();
      setIsProjectModalOpen(false);
      resetProjectForm();
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => refetch(),
  });

  const projectsToRender = projects as Project[];

  const gridData = useMemo(() => {
    return projectsToRender.map((project) => {
      const latestJob = project.jobs?.[0];
      const passed = latestJob?.pass_count ?? 0;
      const failed = latestJob?.fail_count ?? 0;
      const ignored = latestJob?.ignored_count ?? 0;
      const compliance = calculateCompliance(passed, failed);
      return {
        id: project.id,
        name: project.project_name,
        passed,
        failed,
        ignored,
        compliance,
        timestamp: latestJob?.created_at,
        project,
      };
    });
  }, [projectsToRender]);

  const projectRuns: AuditRun[] = useMemo(() => {
    if (!selectedProject?.jobs) return [];
    return selectedProject.jobs
      .map((job: any) => ({
        id: job.job_id,
        passed: job.pass_count ?? 0,
        failed: job.fail_count ?? 0,
        ignored: job.ignored_count ?? 0,
        timestamp: job.created_at,
        tests: job.tests ?? [],
      }))
      .sort((a, b) => {
        // Sort by timestamp descending
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        
        // Fallback to ID descending if timestamps are equal
        return Number(b.id) - Number(a.id);
      });
  }, [selectedProject]);

  const openHistory = (project: Project) => {
    setSelectedProject(project);
    setIsHistoryOpen(true);
  };

  const getComplianceStyle = (value: number) => {
    if (value >= 80) return "bg-success/10 text-success border-success/30 shadow-sm shadow-success/10";
    if (value >= 50) return "bg-muted text-foreground border-border shadow-sm shadow-black/5";
    return "bg-destructive/10 text-destructive border-destructive/30 shadow-sm shadow-destructive/10";
  };

  const resetProjectForm = () => {
    setFormName("");
    setFormDescription("");
    setFormPrompt("");
    setFormRulesMode("global");
    setFormRulesUri("");
    setFormRulesFile(null);
    setRulesUploadStatus("idle");
    setRulesUploadError("");
    setFormUrls("");
    setFormDataSources([]);
    setEditingProjectId(null);
  };

  const openCreateProject = () => {
    resetProjectForm();
    setIsProjectModalOpen(true);
  };

  const openEditProject = (project: Project) => {
    setFormName(project.project_name);
    setFormDescription(project.project_description ?? "");
    setFormPrompt(project.project_prompt ?? "");
    setFormRulesMode(project.rules_mode ?? "global");
    setFormRulesUri(project.rules_uri ?? "");
    setFormRulesFile(null);
    setRulesUploadStatus("idle");
    setRulesUploadError("");
    setFormUrls((project.urls ?? []).join("\n"));
    // Convert URLs to data sources if no data sources exist
    const existingDataSources = (project as any).data_sources ?? [];
    if (existingDataSources.length > 0) {
      const mappedSources: DataSource[] = existingDataSources.map((source: any, index: number) => ({
        id: source.id ?? `ds-${index}-${Date.now()}`,
        name: source.name ?? "",
        method: source.method ?? "GET",
        url: source.url ?? "",
        headers: source.headers ?? [],
        params: source.params ?? [],
        auth: source.auth ?? { type: "none" as const },
        body: source.body ?? "",
        bodyType: source.bodyType ?? "none",
        jsonKeys: source.json_keys ?? source.jsonKeys ?? [],
        jsonKeysText: (source.json_keys ?? source.jsonKeys ?? []).join("\n"),
      }));
      setFormDataSources(mappedSources);
    } else {
      // Convert legacy URLs to data sources
      const urlsArray = project.urls ?? [];
      const convertedSources: DataSource[] = urlsArray.map((url, index) => ({
        id: `legacy-${index}`,
        name: `Data Source ${index + 1}`,
        method: "GET" as const,
        url,
        headers: [],
        params: [],
        auth: { type: "none" as const },
        body: "",
        bodyType: "none" as const,
        jsonKeys: [],
      }));
      setFormDataSources(convertedSources);
    }
    setEditingProjectId(project.id);
    setIsProjectModalOpen(true);
  };

  const saveProject = () => {
    if (!formName.trim()) return;

    const completeSources = formDataSources.filter((source) => {
      const hasUrl = Boolean(source.url?.trim());
      const keysFromText = source.jsonKeysText
        ? source.jsonKeysText
            .split(/\r?\n/)
            .map((key) => key.trim())
            .filter(Boolean)
        : [];
      const keys = keysFromText.length > 0 ? keysFromText : (source.jsonKeys ?? []);
      return hasUrl && keys.length > 0;
    });

    const incompleteSources = formDataSources.filter((source) => {
      const hasUrl = Boolean(source.url?.trim());
      const keysFromText = source.jsonKeysText
        ? source.jsonKeysText
            .split(/\r?\n/)
            .map((key) => key.trim())
            .filter(Boolean)
        : [];
      const keys = keysFromText.length > 0 ? keysFromText : (source.jsonKeys ?? []);
      const hasKeys = keys.length > 0;
      return (hasUrl && !hasKeys) || (!hasUrl && hasKeys);
    });

    if (formDataSources.length > 0 && completeSources.length === 0) {
      alert("Please complete at least one data source with a URL and JSON keys.");
      return;
    }

    if (incompleteSources.length > 0) {
      alert("Please complete or remove partial data sources (each needs a URL and JSON keys).");
      return;
    }

    const requiresRulesFile = formRulesMode === "project" || formRulesMode === "global+project";
    if (requiresRulesFile && !formRulesUri.trim() && !formRulesFile) {
      alert("Rules file is required for the selected mode.");
      return;
    }

    if (editingProjectId) {
      updateProjectMutation.mutate({
        id: editingProjectId,
        payload: {
          project_name: formName.trim(),
          project_description: formDescription.trim(),
          project_prompt: formPrompt.trim(),
          rules_mode: formRulesMode,
          rules_uri: formRulesUri.trim() || null,
          data_sources: formDataSources,
        },
      });
    } else {
      createProjectMutation.mutate({
        project_name: formName.trim(),
        project_description: formDescription.trim(),
        project_prompt: formPrompt.trim(),
        rules_mode: formRulesMode,
        rules_uri: formRulesUri.trim() || null,
        data_sources: formDataSources,
      }, {
        onSuccess: async (created: any) => {
          if (formRulesFile) {
            try {
              setRulesUploadStatus("uploading");
              const uploadRes = await uploadProjectRulesFile(created.id ?? created.project_id ?? created?.data?.id, formRulesFile);
              const rulesUri = uploadRes?.rules_uri ?? uploadRes?.uri ?? uploadRes?.path ?? "";
              if (rulesUri) {
                await updateProject(created.id ?? created.project_id ?? created?.data?.id, {
                  project_name: formName.trim(),
                  project_description: formDescription.trim(),
                  project_prompt: formPrompt.trim(),
                  rules_mode: formRulesMode,
                  rules_uri: rulesUri,
                  data_sources: formDataSources,
                });
                setFormRulesUri(rulesUri);
              }
              setRulesUploadStatus("success");
            } catch (error) {
              console.error("Rules upload failed:", error);
              setRulesUploadStatus("error");
              setRulesUploadError("Rules upload failed.");
            }
          }
          refetch();
          setIsProjectModalOpen(false);
          resetProjectForm();
        },
      });
    }
  };

  const openPostmanModal = (projectId?: string | number) => {
    setPostmanProjectId(projectId ?? null);
    setIsPostmanModalOpen(true);
  };


  const handleViewFailures = (jobId: string | number) => {
    setDrillDownJobId(jobId);
  };

  const handleDeleteProject = (projectId: string | number) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      deleteProjectMutation.mutate(projectId);
    }
  };

  const handleExportFailures = async (jobId: string | number, projectName: string) => {
    try {
      const data = await fetchFailures(jobId);
      const failures = Array.isArray(data) ? data : (data?.failures ?? []);
      
      if (failures.length === 0) {
        alert("No failures to export for this job.");
        return;
      }

      // Format data for CSV
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

      downloadCSV(csvData, `${projectName.replace(/\s+/g, "_")}_failures_job_${jobId}.csv`);
    } catch (error) {
      console.error("Failed to export failures:", error);
      alert("Failed to export failures. Please try again.");
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="bg-white border-b border-border px-8 py-8 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Compliance Validator
            </h1>
            <p className="text-lg text-muted-foreground font-medium">
              Monitor all project audits and compliance status
            </p>
          </div>
          {activeTab === "compliance" && (
            <div className="flex gap-3">
              <Button 
                onClick={() => openPostmanModal()}
                size="lg"
                variant="outline"
                className="shadow-sm transition-all hover:scale-105 active:scale-95 px-6"
              >
                <FlaskConical className="size-5 mr-2" />
                Test API
              </Button>
              <Button 
                onClick={openCreateProject}
                size="lg"
                className="shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 px-6"
              >
                <Plus className="size-5 mr-2" />
                Add Project
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="border-b border-border/60 bg-background px-8">
        <div className="flex gap-2 py-2 max-w-[1600px] mx-auto">
          <Button
            variant={activeTab === "compliance" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("compliance")}
          >
            Compliance
          </Button>
          <Button
            variant={activeTab === "prompt-injection" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("prompt-injection")}
          >
            Prompt Injection
          </Button>
          <Button
            variant={activeTab === "legal-rules" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("legal-rules")}
          >
            Legal Rules
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-muted/20 px-8 py-10">
        <div className="max-w-[1600px] mx-auto space-y-6">
          {activeTab === "compliance" ? (
            <>
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" />
                  Active Projects
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-muted text-xs font-bold text-muted-foreground border">
                    {gridData.length}
                  </span>
                </h2>
              </div>

              <ProjectTable
                rows={gridData}
                onRunAudit={handleRunAudit}
                onRunAuditWithSources={handleRunAuditWithSources}
                onViewHistory={openHistory}
                onEdit={openEditProject}
                onDelete={handleDeleteProject}
                getComplianceStyle={getComplianceStyle}
                formatTimestamp={formatTimestamp}
                isRunningAudit={runAudit.isPending}
                runningProjectId={runningProjectId}
                onViewFailures={handleViewFailures}
                onExportFailures={handleExportFailures}
              />
            </>
          ) : activeTab === "prompt-injection" ? (
            <PromptInjectionPanel />
          ) : (
            <LegalRulesPanel />
          )}
        </div>
      </div>

      <HistoryModal
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        projectName={selectedProject?.project_name}
        projectRuns={projectRuns}
        onViewFailures={handleViewFailures}
      />

      {drillDownJobId && (
        <FailureDrillDown
          jobId={String(drillDownJobId)}
          onClose={() => setDrillDownJobId(null)}
          onIgnoreSuccess={() => refetch()}
        />
      )}

      <ProjectModal
        open={isProjectModalOpen}
        onOpenChange={(open) => {
          setIsProjectModalOpen(open);
          if (!open) resetProjectForm();
        }}
        editing={Boolean(editingProjectId)}
        name={formName}
        description={formDescription}
        prompt={formPrompt}
        rulesMode={formRulesMode}
        rulesUri={formRulesUri}
        rulesFile={formRulesFile}
        rulesUploadStatus={rulesUploadStatus}
        rulesUploadError={rulesUploadError}
        urls={formUrls}
        dataSources={formDataSources}
        onChangeName={setFormName}
        onChangeDescription={setFormDescription}
        onChangePrompt={setFormPrompt}
        onChangeRulesMode={setFormRulesMode}
        onChangeRulesUri={setFormRulesUri}
        onChangeRulesFile={setFormRulesFile}
        onUploadRulesFile={async (file) => {
          if (!editingProjectId) {
            setFormRulesFile(file);
            return;
          }
          try {
            setRulesUploadStatus("uploading");
            setRulesUploadError("");
            const uploadRes = await uploadProjectRulesFile(editingProjectId, file);
            const rulesUri = uploadRes?.rules_uri ?? uploadRes?.uri ?? uploadRes?.path ?? "";
            if (rulesUri) {
              setFormRulesUri(rulesUri);
            }
            setRulesUploadStatus("success");
          } catch (error) {
            console.error("Rules upload failed:", error);
            setRulesUploadStatus("error");
            setRulesUploadError("Rules upload failed.");
          }
        }}
        onChangeUrls={setFormUrls}
        onChangeDataSources={setFormDataSources}
        onSave={saveProject}
        onCancel={() => setIsProjectModalOpen(false)}
        loading={createProjectMutation.isPending || updateProjectMutation.isPending}
      />

      <PostmanRequestModal
        open={isPostmanModalOpen}
        onOpenChange={setIsPostmanModalOpen}
        projectId={postmanProjectId ?? undefined}
      />

      <Dialog open={isRunWithSourcesOpen} onOpenChange={setIsRunWithSourcesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Run With Sources</DialogTitle>
            <DialogDescription>
              Provide a JSON array of one-off sources for this run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={runWithSourcesJson}
              onChange={(event) => setRunWithSourcesJson(event.target.value)}
              rows={10}
              className="font-mono text-sm"
              placeholder='[{"type":"api","url":"https://example.com","headers":{},"content_type":"marketing_copy"}]'
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRunWithSourcesOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!runWithSourcesProject) return;
                  try {
                    const parsed = JSON.parse(runWithSourcesJson);
                    if (!Array.isArray(parsed)) {
                      alert("Please provide a JSON array of sources.");
                      return;
                    }
                    setRunningProjectId(runWithSourcesProject.id);
                    await runAuditJobWithSources(runWithSourcesProject.id, parsed);
                    refetch();
                    setIsRunWithSourcesOpen(false);
                  } catch (error) {
                    console.error("Failed to run with sources:", error);
                    alert("Invalid JSON or run failed.");
                  } finally {
                    setRunningProjectId(null);
                  }
                }}
              >
                Run
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default Dashboard;
