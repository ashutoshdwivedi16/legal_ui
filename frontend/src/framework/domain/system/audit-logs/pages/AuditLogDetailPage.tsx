import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAuditLog } from "../api/audit-logs.api";
import { Button } from "@shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Badge } from "@shared/components/ui/badge";
import { Spinner } from "@shared/components/ui/spinner";
import { AccessDenied } from "@shared/components/AccessDenied";
import { ServerError } from "@shared/components/ServerError";
import { ArrowLeft } from "lucide-react";
import type { AxiosError } from "axios";

export default function AuditLogDetailPage() {
  const { id } = useParams<{ id: string }>();
  
  const { data: log, error, isLoading } = useQuery({
    queryKey: ["audit-log", id],
    queryFn: () => getAuditLog(id!),
    enabled: !!id,
  });

  const errorStatus = error ? (error as AxiosError).response?.status : undefined;

  if (errorStatus === 403) {
    return <AccessDenied description="You do not have permission to view this audit log." />;
  }
  if (errorStatus && errorStatus >= 500) {
    return <ServerError message="Failed to load audit log details." />;
  }
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner className="text-primary size-10" />
      </div>
    );
  }

  if (!log) return <div>Log not found</div>;

  const action = log.action;
  let actionVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
  let actionClass = "";
  if (action === "CREATE" || action === "POST") { actionVariant = "default"; actionClass = "bg-green-600 hover:bg-green-700 text-white"; }
  if (action === "UPDATE" || action === "PUT") { actionVariant = "secondary"; actionClass = "bg-blue-600 hover:bg-blue-700 text-white"; }
  if (action === "DELETE") { actionVariant = "destructive"; actionClass = "bg-red-600 hover:bg-red-700 text-white"; }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/audit-logs">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Audit Log #{log.id}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Request Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="font-semibold text-muted-foreground">Timestamp:</span>
              <span>{new Date(log.timestamp).toLocaleString()}</span>
              
              <span className="font-semibold text-muted-foreground">Action:</span>
              <span><Badge variant={actionVariant} className={actionClass}>{log.action}</Badge></span>
              
              <span className="font-semibold text-muted-foreground">Resource Type:</span>
              <span>{log.resourceType || "—"}</span>
              
              <span className="font-semibold text-muted-foreground">Resource ID:</span>
              <span>{log.resourceId || "—"}</span>

              <span className="font-semibold text-muted-foreground">Service:</span>
              <span>{log.serviceName || "—"}</span>
              
              <span className="font-semibold text-muted-foreground">Endpoint:</span>
              <span className="break-all font-mono text-xs">{log.endpoint || "—"}</span>
              
              <span className="font-semibold text-muted-foreground">Method:</span>
              <span>{log.httpMethod || "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User & Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="font-semibold text-muted-foreground">User Email:</span>
              <span>{log.userEmail || "—"}</span>
              
              <span className="font-semibold text-muted-foreground">User ID:</span>
              <span>{log.userId || "—"}</span>
              
              <span className="font-semibold text-muted-foreground">IP Address:</span>
              <span>{log.ipAddress || "—"}</span>
              
              <span className="font-semibold text-muted-foreground">User Agent:</span>
              <span className="break-all text-xs">{log.userAgent || "—"}</span>

              <span className="font-semibold text-muted-foreground">Correlation ID:</span>
              <span className="font-mono text-xs">{log.correlationId || "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-semibold text-muted-foreground">Status:</span>
              {log.success 
                ? <Badge className="bg-green-600 hover:bg-green-700">Success</Badge>
                : <Badge variant="destructive">Failed</Badge>
              }
            </div>
            
            {!log.success && log.errorMessage && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
                <span className="font-semibold">Error:</span> {log.errorMessage}
              </div>
            )}

            <div>
              <span className="font-semibold text-muted-foreground block mb-2">Details (JSON):</span>
              <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono">
                {log.details ? JSON.stringify(log.details, null, 2) : "No details provided"}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
