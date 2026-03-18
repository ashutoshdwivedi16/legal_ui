import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef, SortingState, VisibilityState, Column } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs, exportAuditLogs } from "../api/audit-logs.api";
import type { AuditLog, AuditLogListParams } from "../api/audit-logs.api";
import { AuditLogFilters } from "../components/AuditLogFilters";
import { Button } from "@shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shared/components/ui/table";
import { Badge } from "@shared/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shared/components/ui/dropdown-menu";
import { PaginationControl } from "@core/components/PaginationControl";
import { Spinner } from "@shared/components/ui/spinner";
import { AccessDenied } from "@shared/components/AccessDenied";
import { ServerError } from "@shared/components/ServerError";
import {
  ChevronDown,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Eye,
  FileSpreadsheet,
  FileJson,
} from "lucide-react";
import type { AxiosError } from "axios";

const COLUMN_VISIBILITY_KEY = "audit-logs-column-visibility";

function SortableHeader<T>({ column, children }: { column: Column<T, unknown>; children: React.ReactNode }) {
  if (!column.getCanSort()) {
    return <span>{children}</span>;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {children}
      {column.getIsSorted() === "asc" ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : column.getIsSorted() === "desc" ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  );
}

export default function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogListParams>({});
  const [currPage, setCurrPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  const sortParam = sorting.length > 0
    ? `${sorting[0].id},${sorting[0].desc ? "desc" : "asc"}`
    : "timestamp,desc";

  const { data, error, isLoading } = useQuery({
    queryKey: ["audit-logs", { ...filters, page: currPage, sort: sortParam }],
    queryFn: () => getAuditLogs({ ...filters, page: currPage - 1, size: 10, sort: sortParam }),
    placeholderData: (prev) => prev,
  });

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = async () => {
    const data = await exportAuditLogs(filters);
    const headers = ["ID", "Timestamp", "User Email", "Action", "Resource Type", "Resource ID", "Success", "Error Message", "Service Name", "Endpoint", "HTTP Method", "IP Address", "Correlation ID"];
    const rows = data.map(log => [
      log.id, log.timestamp, log.userEmail, log.action, log.resourceType, log.resourceId,
      log.success, log.errorMessage, log.serviceName, log.endpoint, log.httpMethod,
      log.ipAddress, log.correlationId
    ].map(v => v != null ? `"${String(v).replace(/"/g, '""')}"` : "").join(","));
    downloadFile([headers.join(","), ...rows].join("\n"), "audit-logs.csv", "text/csv");
  };

  const handleExportJson = async () => {
    const data = await exportAuditLogs(filters);
    downloadFile(JSON.stringify(data, null, 2), "audit-logs.json", "application/json");
  };

  const columns = useMemo<ColumnDef<AuditLog>[]>(() => [
    {
      accessorKey: "timestamp",
      header: ({ column }) => <SortableHeader column={column}>Timestamp</SortableHeader>,
      cell: ({ row }) => new Date(row.getValue("timestamp")).toLocaleString(),
    },
    {
      accessorKey: "userEmail",
      header: ({ column }) => <SortableHeader column={column}>User Email</SortableHeader>,
      cell: ({ row }) => row.getValue("userEmail") || "—",
    },
    {
      accessorKey: "action",
      header: ({ column }) => <SortableHeader column={column}>Action</SortableHeader>,
      cell: ({ row }) => {
        const action = row.getValue("action") as string;
        let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
        if (action === "CREATE" || action === "POST") variant = "default";
        if (action === "UPDATE" || action === "PUT") variant = "secondary";
        if (action === "DELETE") variant = "destructive";
        
        let className = "";
        if (action === "CREATE" || action === "POST") className = "bg-green-600 hover:bg-green-700 text-white";
        if (action === "UPDATE" || action === "PUT") className = "bg-blue-600 hover:bg-blue-700 text-white";
        if (action === "DELETE") className = "bg-red-600 hover:bg-red-700 text-white";

        return <Badge variant={variant} className={className}>{action}</Badge>;
      },
    },
    {
      accessorKey: "resourceType",
      header: ({ column }) => <SortableHeader column={column}>Resource Type</SortableHeader>,
      cell: ({ row }) => row.getValue("resourceType") || "—",
    },
    {
      accessorKey: "resourceId",
      header: "Resource ID",
      cell: ({ row }) => row.getValue("resourceId") || "—",
    },
    {
      accessorKey: "serviceName",
      header: ({ column }) => <SortableHeader column={column}>Service</SortableHeader>,
      cell: ({ row }) => row.getValue("serviceName") || "—",
    },
    {
      accessorKey: "success",
      header: ({ column }) => <SortableHeader column={column}>Success</SortableHeader>,
      cell: ({ row }) => (
        row.getValue("success")
          ? <Badge className="bg-green-600 hover:bg-green-700">Success</Badge>
          : <Badge variant="destructive">Failed</Badge>
      ),
    },
    {
      accessorKey: "ipAddress",
      header: "IP Address",
      cell: ({ row }) => row.getValue("ipAddress") || "—",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Link to={`./${row.original.id}`}>
          <Button size="icon" variant="ghost" title="View Details">
            <Eye className="h-4 w-4" />
          </Button>
        </Link>
      ),
    },
  ], []);

  const table = useReactTable({
    data: data?.content || [],
    columns,
    getRowId: (row) => row.id.toString(),
    manualSorting: true,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      columnVisibility,
    },
  });

  const errorStatus = error ? (error as AxiosError).response?.status : undefined;

  if (errorStatus === 403) {
    return <AccessDenied description="You do not have permission to view audit logs." />;
  }
  if (errorStatus && errorStatus >= 500) {
    return <ServerError message="Failed to load audit logs. Please try again later." />;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCsv}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handleExportJson}>
            <FileJson className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </div>

      <AuditLogFilters
        filters={filters}
        onFiltersChange={(newFilters) => {
          setFilters(newFilters);
          setCurrPage(1);
        }}
        onReset={() => {
          setFilters({});
          setCurrPage(1);
        }}
      />

      <div className="flex justify-end mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table.getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => setColumnVisibility({})}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset to Default
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center flex-1">
          <Spinner className="text-primary size-10" />
        </div>
      ) : (
        <>
          <div className="rounded-md border mb-4">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-sm text-muted-foreground">
              Total {data?.totalElements || 0} records
            </div>
            <PaginationControl
              totalPage={data?.totalPages || 0}
              currPage={currPage}
              setCurrPage={setCurrPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
