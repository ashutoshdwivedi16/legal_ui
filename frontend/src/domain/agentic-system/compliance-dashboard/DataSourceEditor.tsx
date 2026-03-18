import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Send, Lock, TestTube, Info } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Badge } from "@/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { KeyValueEditor } from "./KeyValueEditor";
import { ResponseViewer } from "./ResponseViewer";
import { executeProxyRequest } from "./api";
import {
  type RequestConfig,
  type ResponseData,
  type AuthConfig,
  type HttpMethod,
  HTTP_METHODS,
  AUTH_TYPES,
  BODY_TYPES,
  DEFAULT_REQUEST_CONFIG,
  DEFAULT_AUTH_CONFIG,
} from "./postman-types";

export interface DataSource extends RequestConfig {
  id: string;
  name: string;
  jsonKeys?: string[];
  jsonKeysText?: string;
}

interface DataSourceEditorProps {
  dataSources: DataSource[];
  onChange: (dataSources: DataSource[]) => void;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getMethodColor(method: HttpMethod): string {
  switch (method) {
    case "GET": return "bg-green-500/10 text-green-600 border-green-500/30";
    case "POST": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
    case "PUT": return "bg-blue-500/10 text-blue-600 border-blue-500/30";
    case "DELETE": return "bg-red-500/10 text-red-600 border-red-500/30";
    case "PATCH": return "bg-purple-500/10 text-purple-600 border-purple-500/30";
    default: return "bg-gray-500/10 text-gray-600 border-gray-500/30";
  }
}

interface DataSourceItemProps {
  dataSource: DataSource;
  onChange: (updated: DataSource) => void;
  onRemove: () => void;
  onTest: () => void;
  testResponse: ResponseData | null;
  testLoading: boolean;
  testError: string | null;
}

function normalizeTestUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function DataSourceItem({
  dataSource,
  onChange,
  onRemove,
  onTest,
  testResponse,
  testLoading,
  testError,
}: DataSourceItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"params" | "headers" | "auth" | "body">("headers");

  const updateField = <K extends keyof DataSource>(field: K, value: DataSource[K]) => {
    onChange({ ...dataSource, [field]: value });
  };

  const jsonKeysText =
    dataSource.jsonKeysText ?? (dataSource.jsonKeys ?? []).join("\n");
  const hasUrl = dataSource.url.trim().length > 0;
  const keysFromText = jsonKeysText
    .split(/\r?\n/)
    .map((key) => key.trim())
    .filter(Boolean);
  const hasKeys = keysFromText.length > 0 || (dataSource.jsonKeys ?? []).length > 0;
  const showIncompleteWarning = (hasUrl || hasKeys) && !(hasUrl && hasKeys);

  const updateAuth = (updates: Partial<AuthConfig>) => {
    onChange({ ...dataSource, auth: { ...dataSource.auth, ...updates } });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors">
          <Badge variant="outline" className={getMethodColor(dataSource.method)}>
            {dataSource.method}
          </Badge>
          <span className="flex-1 font-medium truncate">
            {dataSource.name || dataSource.url || "New Data Source"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-3 pb-3 max-w-full overflow-x-hidden">
        <form
          autoComplete="off"
          onSubmit={(event) => event.preventDefault()}
          className="space-y-4"
        >
          <input
            type="text"
            name={`fake-username-${dataSource.id}`}
            autoComplete="username"
            className="hidden"
            tabIndex={-1}
          />
          <input
            type="password"
            name={`fake-password-${dataSource.id}`}
            autoComplete="current-password"
            className="hidden"
            tabIndex={-1}
          />
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-foreground">Data Source Name</label>
          <Input
            value={dataSource.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="e.g., User API, Product Catalog"
            autoComplete="new-password"
            name={`data-source-name-${dataSource.id}`}
            data-lpignore="true"
            data-form-type="other"
            data-1p-ignore="true"
            data-bwignore="true"
          />
          </div>

        {/* Method & URL */}
        <div className="flex flex-wrap items-center gap-2">
            <Select
              value={dataSource.method}
              onValueChange={(value) => updateField("method", value as HttpMethod)}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={dataSource.url}
              onChange={(e) => updateField("url", e.target.value)}
              placeholder="https://api.example.com/data"
              className="flex-1 min-w-0"
              autoComplete="new-password"
              name={`data-source-url-${dataSource.id}`}
              data-lpignore="true"
              data-form-type="other"
              data-1p-ignore="true"
              data-bwignore="true"
            />
            <Button
              type="button"
              variant="outline"
              onClick={onTest}
              disabled={!dataSource.url || testLoading}
              className="shrink-0"
            >
              <TestTube className="h-4 w-4 mr-1" />
              Test
            </Button>
          </div>

          {/* JSON Keys */}
          <div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground">JSON Keys to Validate</label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-5 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
                      aria-label="JSON keys help"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs leading-relaxed">
                    <div className="space-y-2">
                      <p className="font-semibold">JSON key validation</p>
                      <div>
                        <p className="font-medium">Required keys</p>
                        <p>Enter one key per line (e.g., `summary.quickPick`).</p>
                      </div>
                      <div>
                        <p className="font-medium">Expected structure</p>
                        <p>Dot notation supports nested objects and arrays (e.g., `items.0.title`).</p>
                      </div>
                      <div>
                        <p className="font-medium">Validation rules</p>
                        <p>Each listed key must exist in the response JSON for the audit to pass.</p>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Textarea
              value={jsonKeysText}
              onChange={(e) => updateField("jsonKeysText", e.target.value)}
              placeholder={"One key per line (e.g., summary.quickPick)\nsummary.quickPick\nsummary.differentiators"}
              rows={3}
              className="font-mono text-sm"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              name={`data-source-keys-${dataSource.id}`}
              data-lpignore="true"
              data-form-type="other"
              data-1p-ignore="true"
              data-bwignore="true"
            />
          </div>

          {/* Auth Quick Toggle */}
          <div className="flex gap-2">
            <Select
              value={dataSource.auth.type}
              onValueChange={(value) => updateAuth({ type: value as AuthConfig["type"] })}
            >
              <SelectTrigger className="w-40">
                <Lock className="h-3 w-3 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTH_TYPES.map((authType) => (
                  <SelectItem key={authType.value} value={authType.value}>
                    {authType.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {dataSource.auth.type === "bearer" && (
              <Input
                value={dataSource.auth.token ?? ""}
                onChange={(e) => updateAuth({ token: e.target.value })}
                placeholder="Bearer token"
                type="password"
                className="flex-1"
                autoComplete="new-password"
                name={`data-source-bearer-${dataSource.id}`}
                data-lpignore="true"
                data-form-type="other"
                data-1p-ignore="true"
                data-bwignore="true"
              />
            )}

            {dataSource.auth.type === "basic" && (
              <>
                <Input
                  value={dataSource.auth.username ?? ""}
                  onChange={(e) => updateAuth({ username: e.target.value })}
                  placeholder="Username"
                  className="flex-1"
                  autoComplete="new-password"
                  name={`data-source-username-${dataSource.id}`}
                  data-lpignore="true"
                  data-form-type="other"
                  data-1p-ignore="true"
                  data-bwignore="true"
                />
                <Input
                  value={dataSource.auth.password ?? ""}
                  onChange={(e) => updateAuth({ password: e.target.value })}
                  placeholder="Password"
                  type="password"
                  className="flex-1"
                  autoComplete="new-password"
                  name={`data-source-password-${dataSource.id}`}
                  data-lpignore="true"
                  data-form-type="other"
                  data-1p-ignore="true"
                  data-bwignore="true"
                />
              </>
            )}

            {dataSource.auth.type === "api-key" && (
              <>
                <Input
                  value={dataSource.auth.apiKeyName ?? ""}
                  onChange={(e) => updateAuth({ apiKeyName: e.target.value })}
                  placeholder="Key name"
                  className="w-32"
                  autoComplete="new-password"
                  name={`data-source-apikey-name-${dataSource.id}`}
                  data-lpignore="true"
                  data-form-type="other"
                  data-1p-ignore="true"
                  data-bwignore="true"
                />
                <Input
                  value={dataSource.auth.apiKeyValue ?? ""}
                  onChange={(e) => updateAuth({ apiKeyValue: e.target.value })}
                  placeholder="Key value"
                  type="password"
                  className="flex-1"
                  autoComplete="new-password"
                  name={`data-source-apikey-value-${dataSource.id}`}
                  data-lpignore="true"
                  data-form-type="other"
                  data-1p-ignore="true"
                  data-bwignore="true"
                />
                <Select
                  value={dataSource.auth.apiKeyLocation ?? "header"}
                  onValueChange={(value) => updateAuth({ apiKeyLocation: value as "header" | "query" })}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="header">Header</SelectItem>
                    <SelectItem value="query">Query</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {/* Tabs */}
          <div className="border rounded-lg">
            <div className="flex border-b">
              {[
                { key: "headers" as const, label: "Headers", count: dataSource.headers.filter(h => h.enabled).length },
                { key: "params" as const, label: "Params", count: dataSource.params.filter(p => p.enabled).length },
                { key: "body" as const, label: "Body", badge: dataSource.bodyType !== "none" ? dataSource.bodyType : undefined },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                      {tab.count}
                    </span>
                  )}
                  {tab.badge && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-3">
              {activeTab === "headers" && (
                <KeyValueEditor
                  items={dataSource.headers}
                  onChange={(headers) => updateField("headers", headers)}
                  keyPlaceholder="Header Name"
                  valuePlaceholder="Header Value"
                  addButtonText="Add Header"
                />
              )}

              {activeTab === "params" && (
                <KeyValueEditor
                  items={dataSource.params}
                  onChange={(params) => updateField("params", params)}
                  keyPlaceholder="Param Name"
                  valuePlaceholder="Param Value"
                  addButtonText="Add Param"
                />
              )}

              {activeTab === "body" && (
                <div className="space-y-2">
                  <Select
                    value={dataSource.bodyType ?? "none"}
                    onValueChange={(value) => updateField("bodyType", value as DataSource["bodyType"])}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BODY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {dataSource.bodyType && dataSource.bodyType !== "none" && (
                    <Textarea
                      value={dataSource.body ?? ""}
                      onChange={(e) => updateField("body", e.target.value)}
                      placeholder={
                        dataSource.bodyType === "json"
                          ? '{\n  "key": "value"\n}'
                          : "Enter request body"
                      }
                      rows={4}
                      className="font-mono text-sm"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Test Response (reserved space to avoid layout shift) */}
        <div className="mt-2 w-full min-w-0 max-w-full">
          <label className="text-sm font-medium text-foreground">Test Response</label>
          <div className="mt-2 h-[260px] w-full min-w-0 overflow-hidden">
            {testResponse || testLoading || testError ? (
              <ResponseViewer response={testResponse} loading={testLoading} error={testError} />
            ) : (
              <div className="flex items-center justify-center h-full rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
                Run a test to see the response here.
              </div>
            )}
          </div>
        </div>
        {showIncompleteWarning && (
          <div className="text-xs text-destructive">
            Please provide both a URL and at least one JSON key.
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DataSourceEditor({ dataSources, onChange }: DataSourceEditorProps) {
  const [testStates, setTestStates] = useState<Record<string, {
    loading: boolean;
    response: ResponseData | null;
    error: string | null;
  }>>({});

  const createEmptyDataSource = (): DataSource => ({
    id: generateId(),
    name: "",
    method: "GET",
    url: "",
    headers: [],
    params: [],
    auth: { ...DEFAULT_AUTH_CONFIG },
    body: "",
    bodyType: "none",
    jsonKeys: [],
    jsonKeysText: "",
  });

  const addDataSource = () => {
    const newSource = createEmptyDataSource();
    onChange([...dataSources, newSource]);
  };

  const canAddDataSource = dataSources.every((source) => {
    const hasUrl = source.url.trim().length > 0;
    const keysFromText = source.jsonKeysText
      ? source.jsonKeysText
          .split(/\r?\n/)
          .map((key) => key.trim())
          .filter(Boolean)
      : [];
    const keys = keysFromText.length > 0 ? keysFromText : (source.jsonKeys ?? []);
    const hasKeys = keys.length > 0;
    return hasUrl && hasKeys;
  });

  const updateDataSource = (index: number, updated: DataSource) => {
    const newSources = [...dataSources];
    newSources[index] = updated;
    onChange(newSources);
  };

  const removeDataSource = (index: number) => {
    onChange(dataSources.filter((_, i) => i !== index));
  };

  const testDataSource = async (dataSource: DataSource) => {
    if (!dataSource.url) return;

    setTestStates((prev) => ({
      ...prev,
      [dataSource.id]: { loading: true, response: null, error: null },
    }));

    const startTime = performance.now();

    try {
      const proxyResult = await executeProxyRequest({
        method: dataSource.method,
        url: normalizeTestUrl(dataSource.url),
        headers: dataSource.headers,
        params: dataSource.params,
        auth: dataSource.auth,
        body: dataSource.body,
        bodyType: dataSource.bodyType,
      } as RequestConfig);
      const endTime = performance.now();

      setTestStates((prev) => ({
        ...prev,
        [dataSource.id]: {
          loading: false,
          response: {
            status: proxyResult.status,
            statusText: proxyResult.statusText,
            headers: proxyResult.headers,
            body: proxyResult.body,
            time: proxyResult.time ?? Math.round(endTime - startTime),
            size: typeof proxyResult.body === "string" ? proxyResult.body.length : JSON.stringify(proxyResult.body).length,
          },
          error: null,
        },
      }));
    } catch (err) {
      setTestStates((prev) => ({
        ...prev,
        [dataSource.id]: {
          loading: false,
          response: null,
          error: err instanceof Error ? err.message : "Request failed",
        },
      }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          Data Sources ({dataSources.length})
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addDataSource}
          disabled={!canAddDataSource}
          title={!canAddDataSource ? "Please enter a URL for all data sources before adding another." : undefined}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Data Source
        </Button>
      </div>

      {dataSources.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
          <p>No data sources configured</p>
          <p className="text-sm mt-1">Add an API endpoint to fetch data for compliance testing</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dataSources.map((ds, index) => {
            const testState = testStates[ds.id];
            return (
              <DataSourceItem
                key={ds.id}
                dataSource={ds}
                onChange={(updated) => updateDataSource(index, updated)}
                onRemove={() => removeDataSource(index)}
                onTest={() => testDataSource(ds)}
                testResponse={testState?.response ?? null}
                testLoading={testState?.loading ?? false}
                testError={testState?.error ?? null}
              />
            );
          })}
        </div>
      )}

    </div>
  );
}
