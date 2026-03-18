import { useState } from "react";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Label } from "@shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@shared/components/ui/collapsible";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import type { AuditLogListParams } from "../api/audit-logs.api";

type AuditLogFiltersProps = {
  filters: AuditLogListParams;
  onFiltersChange: (filters: AuditLogListParams) => void;
  onReset: () => void;
};

export function AuditLogFilters({
  filters,
  onFiltersChange,
  onReset,
}: AuditLogFiltersProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleChange = (key: keyof AuditLogListParams, value: unknown) => {
    onFiltersChange({ ...filters, [key]: value === "all" ? undefined : value });
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="w-full space-y-2 border rounded-md p-4 mb-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Filters</h3>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle filters</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="userEmail">User Email</Label>
            <Input
              id="userEmail"
              placeholder="Filter by email..."
              value={filters.userEmail || ""}
              onChange={(e) => handleChange("userEmail", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="action">Action</Label>
            <Select
              value={filters.action || "all"}
              onValueChange={(value) => handleChange("action", value)}
            >
              <SelectTrigger id="action">
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CREATE">CREATE</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
                <SelectItem value="LOGIN">LOGIN</SelectItem>
                <SelectItem value="LOGOUT">LOGOUT</SelectItem>
                <SelectItem value="view">VIEW</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="resourceType">Resource Type</Label>
            <Select
              value={filters.resourceType || "all"}
              onValueChange={(value) => handleChange("resourceType", value)}
            >
              <SelectTrigger id="resourceType">
                <SelectValue placeholder="Select resource type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Role">Role</SelectItem>
                <SelectItem value="Permission">Permission</SelectItem>
                <SelectItem value="Communication">Communication</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="serviceName">Service Name</Label>
            <Input
              id="serviceName"
              placeholder="Filter by service..."
              value={filters.serviceName || ""}
              onChange={(e) => handleChange("serviceName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="success">Status</Label>
            <Select
              value={filters.success === undefined ? "all" : filters.success.toString()}
              onValueChange={(value) => {
                if (value === "all") handleChange("success", undefined);
                else handleChange("success", value === "true");
              }}
            >
              <SelectTrigger id="success">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="true">Success</SelectItem>
                <SelectItem value="false">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={filters.startDate || ""}
              onChange={(e) => handleChange("startDate", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={filters.endDate || ""}
              onChange={(e) => handleChange("endDate", e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Filters
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
