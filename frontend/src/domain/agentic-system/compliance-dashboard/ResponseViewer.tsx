import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import type { ResponseData } from "./postman-types";

interface ResponseViewerProps {
  response: ResponseData | null;
  loading?: boolean;
  error?: string | null;
}

export function ResponseViewer({ response, loading, error }: ResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<"body" | "headers">("body");
  const [copied, setCopied] = useState(false);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "bg-green-500/10 text-green-600 border-green-500/30";
    if (status >= 300 && status < 400) return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
    if (status >= 400 && status < 500) return "bg-orange-500/10 text-orange-600 border-orange-500/30";
    if (status >= 500) return "bg-red-500/10 text-red-600 border-red-500/30";
    return "bg-gray-500/10 text-gray-600 border-gray-500/30";
  };

  const formatSize = (size?: number) => {
    if (!size) return "";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatBody = (body: unknown): string => {
    if (typeof body === "string") {
      try {
        return JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        return body;
      }
    }
    return JSON.stringify(body, null, 2);
  };

  const handleCopy = async () => {
    if (response?.body) {
      await navigator.clipboard.writeText(formatBody(response.body));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          <span>Sending request...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 h-full bg-destructive/10 border border-destructive/30 rounded-lg">
        <p className="text-destructive font-medium">Error</p>
        <p className="text-sm text-destructive/80 mt-1">{error}</p>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg border">
        <p className="text-muted-foreground">Send a request to see the response</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg max-w-full w-full min-w-0 h-full flex flex-col overflow-x-hidden">
      {/* Status Bar */}
      <div className="flex items-center gap-4 p-3 bg-muted/50 border-b">
        <Badge variant="outline" className={getStatusColor(response.status)}>
          HTTP {response.status} {response.statusText}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Time: {response.time}ms
        </span>
        {response.size && (
          <span className="text-sm text-muted-foreground">
            Size: {formatSize(response.size)}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "body"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("body")}
        >
          Body
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "headers"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("headers")}
        >
          Headers ({Object.keys(response.headers).length})
        </button>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-h-0 min-w-0 overflow-x-hidden">
        {activeTab === "body" && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <pre className="p-4 text-sm overflow-x-auto overflow-y-auto h-full w-full min-w-0 max-w-full bg-slate-950 text-green-400 font-mono whitespace-pre-wrap break-words">
              {formatBody(response.body)}
            </pre>
          </>
        )}

        {activeTab === "headers" && (
          <div className="p-4 space-y-1 h-full w-full min-w-0 overflow-x-auto overflow-y-auto bg-muted/30">
            {Object.entries(response.headers).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-sm">
                <span className="font-medium text-primary whitespace-nowrap">{key}:</span>
                <span className="text-muted-foreground break-all">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
