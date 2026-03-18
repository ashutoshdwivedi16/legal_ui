import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { DataSourceEditor, type DataSource } from "./DataSourceEditor";

interface ProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  name: string;
  description: string;
  prompt: string;
  rulesMode: "global" | "project" | "global+project";
  rulesUri: string;
  rulesFile: File | null;
  rulesUploadStatus: "idle" | "uploading" | "success" | "error";
  rulesUploadError: string;
  urls: string;
  dataSources?: DataSource[];
  onChangeName: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangePrompt: (value: string) => void;
  onChangeRulesMode: (value: "global" | "project" | "global+project") => void;
  onChangeRulesUri: (value: string) => void;
  onChangeRulesFile: (file: File | null) => void;
  onUploadRulesFile: (file: File) => void;
  onChangeUrls: (value: string) => void;
  onChangeDataSources?: (dataSources: DataSource[]) => void;
  onSave: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ProjectModal({
  open,
  onOpenChange,
  editing,
  name,
  description,
  prompt,
  rulesMode,
  rulesUri,
  rulesFile,
  rulesUploadStatus,
  rulesUploadError,
  urls,
  dataSources = [],
  onChangeName,
  onChangeDescription,
  onChangePrompt,
  onChangeRulesMode,
  onChangeRulesUri,
  onChangeRulesFile,
  onUploadRulesFile,
  onChangeUrls,
  onChangeDataSources,
  onSave,
  onCancel,
  loading = false,
}: ProjectModalProps) {
  const hasIncompleteDataSource = dataSources.some((source) => {
    const hasUrl = Boolean(source.url?.trim());
    const keysFromText = source.jsonKeysText
      ? source.jsonKeysText
          .split(/\r?\n/)
          .map((key) => key.trim())
          .filter(Boolean)
      : [];
    const keys = keysFromText.length > 0 ? keysFromText : (source.jsonKeys ?? []);
    const hasKeys = keys.length > 0;
    return (hasUrl || hasKeys) && !(hasUrl && hasKeys);
  });

  const hasAnyCompleteDataSource = dataSources.some((source) => {
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

  const disableSave =
    !name.trim() ||
    loading ||
    ((rulesMode === "project" || rulesMode === "global+project") && !rulesUri.trim()) ||
    hasIncompleteDataSource ||
    (dataSources.length > 0 && !hasAnyCompleteDataSource);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto max-w-6xl w-[95vw]"
      >
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Project" : "Add Project"}</DialogTitle>
          <DialogDescription>Configure project details and API data sources for compliance testing.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {onChangeDataSources && (hasIncompleteDataSource || (dataSources.length > 0 && !hasAnyCompleteDataSource)) && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Please complete each data source with both a URL and at least one JSON key, or remove it.
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Project Name</label>
              <Input
                value={name}
                onChange={(event) => onChangeName(event.target.value)}
                placeholder="Enter project name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <Input
                value={description}
                onChange={(event) => onChangeDescription(event.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Project Prompt</label>
            <Textarea
              value={prompt}
              onChange={(event) => onChangePrompt(event.target.value)}
              placeholder="Project-specific prompt for compliance runs"
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground">Rules Mode</label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-5 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
                      aria-label="Rules mode help"
                    >
                      ?
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs leading-relaxed">
                    Global + Project rules apply in order; project rules override by rule_id.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid gap-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="rules-mode"
                  checked={rulesMode === "global"}
                  onChange={() => onChangeRulesMode("global")}
                />
                <span>
                  <span className="font-medium">Global rules only</span>
                  <span className="block text-xs text-muted-foreground">Use default system rules. Recommended.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="rules-mode"
                  checked={rulesMode === "project"}
                  onChange={() => onChangeRulesMode("project")}
                />
                <span>
                  <span className="font-medium">Project rules only</span>
                  <span className="block text-xs text-muted-foreground">Ignore global rules and use only project rules.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="rules-mode"
                  checked={rulesMode === "global+project"}
                  onChange={() => onChangeRulesMode("global+project")}
                />
                <span>
                  <span className="font-medium">Global + Project rules</span>
                  <span className="block text-xs text-muted-foreground">Project rules override by rule_id.</span>
                </span>
              </label>
            </div>
            {(rulesMode === "project" || rulesMode === "global+project") && (
              <div>
                <label className="text-sm font-medium text-foreground">
                  Rules File URI <span className="text-destructive">*</span>
                </label>
                <Input
                  value={rulesUri}
                  onChange={(event) => onChangeRulesUri(event.target.value)}
                  placeholder="file:///path/to/rules.json"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Example: file:///path/to/rules.json (S3 supported later)
                </p>
                {!rulesUri.trim() && !rulesFile && (
                  <p className="mt-1 text-xs text-destructive">Rules file URI is required for this mode.</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => onChangeRulesFile(event.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!rulesFile || rulesUploadStatus === "uploading"}
                    onClick={() => rulesFile && onUploadRulesFile(rulesFile)}
                  >
                    {rulesUploadStatus === "uploading" ? "Uploading..." : "Upload"}
                  </Button>
                </div>
                {rulesFile && rulesUploadStatus === "success" && (
                  <p className="mt-2 text-xs text-success">Uploaded: {rulesFile.name}</p>
                )}
                {rulesUploadStatus === "error" && (
                  <p className="mt-2 text-xs text-destructive">{rulesUploadError || "Upload failed."}</p>
                )}
              </div>
            )}
          </div>

          {/* Data Sources Section */}
          {onChangeDataSources && (
            <DataSourceEditor
              dataSources={dataSources}
              onChange={onChangeDataSources}
            />
          )}

          {/* Legacy URLs (fallback) */}
          {!onChangeDataSources && (
            <div>
              <label className="text-sm font-medium text-foreground">Project URLs</label>
              <Textarea
                value={urls}
                onChange={(event) => onChangeUrls(event.target.value)}
                placeholder="One URL per line"
                rows={4}
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={disableSave}>
            {loading ? (editing ? "Saving..." : "Creating...") : editing ? "Save Changes" : "Create Project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
