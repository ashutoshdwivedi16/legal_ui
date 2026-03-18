import { useState, useCallback } from "react";
import { Send, Lock, Save } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
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
} from "./postman-types";

interface PostmanRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string | number;
  onSaveRequest?: (config: RequestConfig) => void;
  initialConfig?: RequestConfig;
}

export function PostmanRequestModal({
  open,
  onOpenChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  projectId,
  onSaveRequest,
  initialConfig,
}: PostmanRequestModalProps) {
  const [activeTab, setActiveTab] = useState<"params" | "headers" | "auth" | "body">("params");
  const [config, setConfig] = useState<RequestConfig>(initialConfig ?? DEFAULT_REQUEST_CONFIG);
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [requestName, setRequestName] = useState(initialConfig?.name ?? "");

  const updateConfig = useCallback((updates: Partial<RequestConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateAuth = useCallback((updates: Partial<AuthConfig>) => {
    setConfig((prev) => ({
      ...prev,
      auth: { ...prev.auth, ...updates },
    }));
  }, []);

  const sendRequest = async () => {
    if (!config.url.trim()) {
      setError("Please enter a URL");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await executeProxyRequest(config);
      const body = res.body;
      const size = typeof body === "string" ? body.length : JSON.stringify(body ?? {}).length;
      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: res.headers ?? {},
        body,
        time: res.time,
        size,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (onSaveRequest) {
      onSaveRequest({ ...config, name: requestName });
    }
  };

  const resetForm = () => {
    setConfig(DEFAULT_REQUEST_CONFIG);
    setResponse(null);
    setError(null);
    setRequestName("");
    setShowAuth(false);
  };

  const tabs = [
    { key: "params" as const, label: "Params", count: config.params.filter((p) => p.enabled).length },
    { key: "headers" as const, label: "Headers", count: config.headers.filter((h) => h.enabled).length },
    { key: "auth" as const, label: "Auth", badge: config.auth.type !== "none" ? config.auth.type : undefined },
    { key: "body" as const, label: "Body", badge: config.bodyType !== "none" ? config.bodyType : undefined },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>HTTP Request Tester</DialogTitle>
          <DialogDescription>
            Build and test API requests. Configure method, URL, headers, and parameters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Request Name */}
          <div>
            <label className="text-sm font-medium text-foreground">Request Name</label>
            <Input
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              placeholder="Enter a name for this request (optional)"
            />
          </div>

          {/* Method & URL Row */}
          <div className="flex gap-2">
            <Select
              value={config.method}
              onValueChange={(value) => updateConfig({ method: value as HttpMethod })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    <span className={
                      method === "GET" ? "text-green-600" :
                      method === "POST" ? "text-yellow-600" :
                      method === "PUT" ? "text-blue-600" :
                      method === "DELETE" ? "text-red-600" :
                      method === "PATCH" ? "text-purple-600" :
                      "text-gray-600"
                    }>
                      {method}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={config.url}
              onChange={(e) => updateConfig({ url: e.target.value })}
              placeholder="Enter request URL (e.g., https://api.example.com/endpoint)"
              className="flex-1"
            />

            <Button onClick={sendRequest} disabled={loading}>
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAuth(!showAuth)}
              className={config.auth.type !== "none" ? "border-primary text-primary" : ""}
            >
              <Lock className="h-4 w-4 mr-1" />
              {config.auth.type !== "none" ? `Auth: ${config.auth.type}` : "Add Authentication"}
            </Button>
          </div>

          {/* Auth Section (Collapsible) */}
          {showAuth && (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Authentication</label>
                <Select
                  value={config.auth.type}
                  onValueChange={(value) => updateAuth({ type: value as AuthConfig["type"] })}
                >
                  <SelectTrigger className="w-40">
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
              </div>

              {config.auth.type === "bearer" && (
                <Input
                  value={config.auth.token ?? ""}
                  onChange={(e) => updateAuth({ token: e.target.value })}
                  placeholder="Enter Bearer token"
                  type="password"
                />
              )}

              {config.auth.type === "basic" && (
                <div className="flex gap-2">
                  <Input
                    value={config.auth.username ?? ""}
                    onChange={(e) => updateAuth({ username: e.target.value })}
                    placeholder="Username"
                    className="flex-1"
                  />
                  <Input
                    value={config.auth.password ?? ""}
                    onChange={(e) => updateAuth({ password: e.target.value })}
                    placeholder="Password"
                    type="password"
                    className="flex-1"
                  />
                </div>
              )}

              {config.auth.type === "api-key" && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={config.auth.apiKeyName ?? ""}
                      onChange={(e) => updateAuth({ apiKeyName: e.target.value })}
                      placeholder="Key name (e.g., X-API-Key)"
                      className="flex-1"
                    />
                    <Input
                      value={config.auth.apiKeyValue ?? ""}
                      onChange={(e) => updateAuth({ apiKeyValue: e.target.value })}
                      placeholder="Key value"
                      type="password"
                      className="flex-1"
                    />
                  </div>
                  <Select
                    value={config.auth.apiKeyLocation ?? "header"}
                    onValueChange={(value) => updateAuth({ apiKeyLocation: value as "header" | "query" })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="header">Add to Header</SelectItem>
                      <SelectItem value="query">Add to Query Params</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="border-b">
            <div className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
          </div>

          {/* Tab Content */}
          <div className="min-h-32">
            {activeTab === "params" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Query Parameters</label>
                <KeyValueEditor
                  items={config.params}
                  onChange={(params) => updateConfig({ params })}
                  keyPlaceholder="Parameter Name"
                  valuePlaceholder="Parameter Value"
                  addButtonText="Add Parameter"
                />
              </div>
            )}

            {activeTab === "headers" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Request Headers</label>
                <KeyValueEditor
                  items={config.headers}
                  onChange={(headers) => updateConfig({ headers })}
                  keyPlaceholder="Header Name"
                  valuePlaceholder="Header Value"
                  addButtonText="Add Header"
                />
              </div>
            )}

            {activeTab === "auth" && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Authentication</label>
                <p className="text-sm text-muted-foreground">
                  Configure authentication using the button above or select directly here.
                </p>
                <Select
                  value={config.auth.type}
                  onValueChange={(value) => {
                    updateAuth({ type: value as AuthConfig["type"] });
                    setShowAuth(value !== "none");
                  }}
                >
                  <SelectTrigger className="w-48">
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
              </div>
            )}

            {activeTab === "body" && (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-foreground">Body Type</label>
                  <Select
                    value={config.bodyType ?? "none"}
                    onValueChange={(value) => updateConfig({ bodyType: value as RequestConfig["bodyType"] })}
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
                </div>

                {config.bodyType && config.bodyType !== "none" && (
                  <Textarea
                    value={config.body ?? ""}
                    onChange={(e) => updateConfig({ body: e.target.value })}
                    placeholder={
                      config.bodyType === "json"
                        ? '{\n  "key": "value"\n}'
                        : "Enter request body"
                    }
                    rows={8}
                    className="font-mono text-sm"
                  />
                )}
              </div>
            )}
          </div>

          {/* Response Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Response</label>
            <ResponseViewer response={response} loading={loading} error={error} />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-between pt-2 border-t">
            <Button variant="outline" onClick={resetForm}>
              Reset
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {onSaveRequest && (
                <Button onClick={handleSave} disabled={!config.url.trim()}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Request
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
