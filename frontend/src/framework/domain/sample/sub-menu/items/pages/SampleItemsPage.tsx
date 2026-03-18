import { getSampleItems, deleteSampleItem, deleteSampleItems } from "../api/sample.api";
import type { SampleItem } from "../api/sample.api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@shared/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/components/ui/select";
import { Spinner } from "@shared/components/ui/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  SearchIcon,
  SquarePenIcon,
  Trash2Icon,
  XIcon,
  ChevronDown,
  EyeIcon,
  RotateCcwIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
  PlusIcon,
} from "lucide-react";
import debounce from "lodash/debounce";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@shared/components/ui/button";
import { NavLink, useNavigate } from "react-router-dom";
import { PaginationControl } from "@core/components/PaginationControl";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@shared/components/ui/alert-dialog";
import { toast } from "sonner";
import { Badge } from "@shared/components/ui/badge";
import { Checkbox } from "@shared/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shared/components/ui/dropdown-menu";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, VisibilityState, SortingState, Column } from "@tanstack/react-table";
import { usePermissionStore } from "@core/auth/stores/permissionStore";

const COLUMN_VISIBILITY_KEY = "sample-items-column-visibility";

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
        <ArrowUpIcon className="ml-2 h-4 w-4" />
      ) : column.getIsSorted() === "desc" ? (
        <ArrowDownIcon className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDownIcon className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  );
}

export const SampleItemsList = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const handleClear = () => {
    const el = searchInputRef.current;
    if (!el) return;
    el.value = "";
    setQuery("");
    el.focus();
  };

  const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE" | "INACTIVE" | "PENDING" | "ARCHIVED">("all");
  const [currPage, setCurrPage] = useState(1);
  const [rowSelection, setRowSelection] = useState({});
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  
  const { hasPermission } = usePermissionStore();
  const canCreate = hasPermission('sample:create');
  const canUpdate = hasPermission('sample:update');
  const canDelete = hasPermission('sample:delete');

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  const resetColumnVisibility = () => {
    setColumnVisibility({});
    localStorage.removeItem(COLUMN_VISIBILITY_KEY);
  };

  const sortParam = sorting.length > 0
    ? `${sorting[0].id},${sorting[0].desc ? "desc" : "asc"}`
    : undefined;

  const { status, data, error, refetch } = useQuery({
    queryKey: ["sampleItems", { query, statusFilter, currPage, sortParam }],
    queryFn: () => getSampleItems({ query, status: statusFilter, page: currPage - 1, size: 10, sort: sortParam }),
    placeholderData: (prev) => prev,
  });

  const totalPage = data?.totalPages || 0;
  const itemList = data?.content || [];

  const deleteItemMutation = useMutation({
    mutationFn: deleteSampleItem,
    onSuccess: () => {
      toast.success("Item deleted successfully");
      refetch();
    },
    onError: () => {
      toast.error("Failed to delete item");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: deleteSampleItems,
    onSuccess: (_, deletedIds) => {
      toast.success(`${deletedIds.length} item(s) deleted successfully`);
      setRowSelection({});
      refetch();
    },
    onError: () => {
      toast.error("Failed to delete items");
    },
  });

  const columns: ColumnDef<SampleItem>[] = [
    ...(canDelete ? [{
      id: "select",
      header: ({ table }: any) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value: boolean) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }: any) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value: boolean) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    } as ColumnDef<SampleItem>] : []),
    {
      accessorKey: "id",
      header: ({ column }) => <SortableHeader column={column}>ID</SortableHeader>,
      cell: ({ row }) => row.getValue("id"),
    },
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
      cell: ({ row }) => row.getValue("name"),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <span className="truncate max-w-[200px] block" title={row.getValue("description")}>{row.getValue("description")}</span>,
      enableSorting: false,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
        if (status === "ACTIVE") variant = "default";
        if (status === "INACTIVE") variant = "secondary";
        if (status === "PENDING") variant = "outline";
        if (status === "ARCHIVED") variant = "outline";
        
        return <Badge variant={variant} className={status === 'ACTIVE' ? "bg-green-600 hover:bg-green-700" : ""}>{status}</Badge>;
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <SortableHeader column={column}>Created At</SortableHeader>,
      cell: ({ row }) => new Date(row.getValue("createdAt")).toLocaleDateString(),
    },
    {
      id: "actions",
      header: "Actions",
      enableHiding: false,
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-1">
            <NavLink to={`./${row.original.id}?mode=view`}>
              <Button size="icon" variant="ghost" title="View">
                <EyeIcon className="h-4 w-4" />
              </Button>
            </NavLink>
            {canUpdate && (
              <NavLink to={`./${row.original.id}`}>
                <Button size="icon" variant="ghost" title="Edit">
                  <SquarePenIcon className="h-4 w-4" />
                </Button>
              </NavLink>
            )}
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" title="Delete">
                    <Trash2Icon className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Item?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this item? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className={buttonVariants({ variant: "destructive" })}
                      onClick={() => deleteItemMutation.mutate(row.original.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: itemList,
    columns,
    manualSorting: true,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      rowSelection,
      columnVisibility,
    },
  });

  const selectedItems = table.getFilteredSelectedRowModel().rows.map(row => row.original);
  const selectedItemIds = selectedItems.map(item => item.id);

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(selectedItemIds);
    setBulkDeleteOpen(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header Row: Title + Bulk Delete + Create */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Sample Items</h1>
        <div className="flex items-center gap-2">
          {canDelete && selectedItemIds.length > 0 && (
            <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2Icon className="mr-2 h-4 w-4" />
                  Delete ({selectedItemIds.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedItemIds.length} Item(s)?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedItemIds.length} selected item(s)? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className={buttonVariants({ variant: "destructive" })}
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                  >
                    {bulkDeleteMutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canCreate && (
            <Button onClick={() => navigate("./new")}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Create New Item
            </Button>
          )}
        </div>
      </div>

      {/* Table Controls Row: Search + Filter (left) | Columns (right) */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <InputGroup className="w-[360px]">
            <InputGroupInput
              placeholder="Search items..."
              onChange={debounce((e) => setQuery(e.target.value), 500)}
              ref={searchInputRef}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                onClick={handleClear}
                size="icon-xs"
                aria-label="Clear"
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <Select
            defaultValue="all"
            value={statusFilter}
            onValueChange={(val: "all" | "ACTIVE" | "INACTIVE" | "PENDING" | "ARCHIVED") => setStatusFilter(val)}
          >
            <SelectTrigger className="w-auto min-w-[120px]">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent className="w-auto min-w-[120px]">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
                onClick={resetColumnVisibility}
              >
                <RotateCcwIcon className="mr-2 h-4 w-4" />
                Reset to Default
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {status === "pending" && (
        <div className="flex justify-center items-center flex-1">
          <Spinner className="text-primary size-10" />
        </div>
      )}
      {status === "error" && <span>Error: {error.message}</span>}
      {status === "success" && (
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
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
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
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
            <PaginationControl {...{ totalPage, currPage, setCurrPage }} />
          </div>
        </>
      )}
    </div>
  );
};

export default SampleItemsList;
