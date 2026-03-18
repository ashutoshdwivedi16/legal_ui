import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table';
import type { ColumnDef, SortingState, RowSelectionState, VisibilityState, Column } from '@tanstack/react-table';
import { useRolesQuery, useDeleteRoleMutation, useDeleteRolesMutation } from '../api/roles.api';
import type { RoleDetail } from '../api/roles.api';
import { Button, buttonVariants } from '@shared/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@shared/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/components/ui/table';
import { Checkbox } from '@shared/components/ui/checkbox';
import { Badge } from '@shared/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@shared/components/ui/alert-dialog';
import { PaginationControl } from '@core/components/PaginationControl';
import { Spinner } from '@shared/components/ui/spinner';
import { AccessDenied } from '@shared/components/AccessDenied';
import { ServerError } from '@shared/components/ServerError';
import { toast } from 'sonner';
import {
  SearchIcon,
  XIcon,
  PlusIcon,
  Trash2Icon,
  ChevronDown,
  RotateCcwIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
  EyeIcon,
  SquarePenIcon,
} from 'lucide-react';
import debounce from 'lodash/debounce';
import type { AxiosError } from 'axios';
import { usePermissionStore } from '@core/auth/stores/permissionStore';

const COLUMN_VISIBILITY_KEY = "roles-page-column-visibility";

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

export default function RolesPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [currPage, setCurrPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const { hasPermission } = usePermissionStore();
  const canCreate = hasPermission('admin.roles:create');
  const canUpdate = hasPermission('admin.roles:update');
  const canDelete = hasPermission('admin.roles:delete');

  useEffect(() => {
    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  const sortParam = sorting.length > 0
    ? `${sorting[0].id},${sorting[0].desc ? "desc" : "asc"}`
    : undefined;

  const { status, data, error, refetch } = useRolesQuery({
    page: currPage - 1,
    size: 10,
    name: query,
    active: statusFilter === "all" ? undefined : statusFilter === "active",
    sort: sortParam
  });

  const deleteRoleMutation = useDeleteRoleMutation();
  const bulkDeleteMutation = useDeleteRolesMutation();

  const handleDeleteRole = useCallback(async (id: number) => {
    try {
      await deleteRoleMutation.mutateAsync(id);
      toast.success("Role deleted successfully");
      refetch();
    } catch (error) {
      toast.error("Failed to delete role");
    }
  }, [deleteRoleMutation, refetch]);

  const columns = useMemo<ColumnDef<RoleDetail>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <span className="text-muted-foreground truncate max-w-[300px] block" title={row.getValue("description")}>{row.getValue("description") || "—"}</span>,
    },
    {
      accessorKey: "active",
      header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
      cell: ({ row }) => (
        row.getValue("active") 
          ? <Badge variant="default" className="bg-green-600 hover:bg-green-700">Active</Badge>
          : <Badge variant="secondary">Inactive</Badge>
      ),
    },
    {
      accessorKey: "isAdmin",
      header: ({ column }) => <SortableHeader column={column}>Type</SortableHeader>,
      cell: ({ row }) => (
        row.getValue("isAdmin") 
          ? <Badge variant="destructive" className="text-primary-foreground">ADMIN</Badge>
          : <Badge variant="outline">STANDARD</Badge>
      ),
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
            <NavLink to={`./${row.original.id}/view`}>
              <Button size="icon" variant="ghost" title="View">
                <EyeIcon className="h-4 w-4" />
              </Button>
            </NavLink>
            {canUpdate && (
              <NavLink to={`./${row.original.id}/edit`}>
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
                    <AlertDialogTitle>Delete Role?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this role? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className={buttonVariants({ variant: "destructive" })}
                      onClick={() => handleDeleteRole(row.original.id)}
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
  ], [handleDeleteRole, canUpdate, canDelete]);

  const table = useReactTable({
    data: data?.content || [],
    columns,
    getRowId: (row) => row.id.toString(),
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

  const executeBulkDelete = async () => {
    const selectedIds = Object.keys(rowSelection).map(Number);
    try {
      await bulkDeleteMutation.mutateAsync(selectedIds);
      toast.success(`${selectedIds.length} role(s) deleted successfully`);
      setRowSelection({});
      setBulkDeleteOpen(false);
      refetch();
    } catch (error) {
      toast.error("Failed to delete roles");
    }
  };

  const selectedCount = Object.keys(rowSelection).length;

  const errorStatus = error ? (error as AxiosError).response?.status : undefined;

  if (errorStatus === 403) {
    return <AccessDenied description="You do not have permission to view roles." />;
  }
  if (errorStatus && errorStatus >= 500) {
    return <ServerError message="Failed to load roles. Please try again later." />;
  }

  const tableControls = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <InputGroup className="w-[360px]">
          <InputGroupInput
            placeholder="Search roles..."
            onChange={debounce((e) => setQuery(e.target.value), 500)}
          />
          <InputGroupAddon><SearchIcon /></InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <InputGroupButton onClick={() => setQuery("")} size="icon-xs" aria-label="Clear">
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <Select
          defaultValue="all"
          value={statusFilter}
          onValueChange={(val: "all" | "active" | "inactive") => setStatusFilter(val)}
        >
          <SelectTrigger className="w-auto min-w-[120px]">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-[120px]">
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
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
              onClick={() => setColumnVisibility({})}
            >
              <RotateCcwIcon className="mr-2 h-4 w-4" />
              Reset to Default
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (status === "pending") {
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Roles</h1>
          {canCreate && (
            <Button onClick={() => navigate("./new")}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Role
            </Button>
          )}
        </div>
        {tableControls}
        <div className="flex justify-center items-center flex-1">
          <Spinner className="text-primary size-10" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Roles</h1>
        <div className="flex items-center gap-2">
          {canDelete && selectedCount > 0 && (
            <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2Icon className="mr-2 h-4 w-4" />
                  Delete ({selectedCount})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedCount} Role(s)?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedCount} selected role(s)?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className={buttonVariants({ variant: "destructive" })}
                    onClick={executeBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {canCreate && (
            <Button onClick={() => navigate("./new")}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Role
            </Button>
          )}
        </div>
      </div>

      {tableControls}

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
          {selectedCount} of {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <PaginationControl 
          totalPage={data?.totalPages || 0}
          currPage={currPage}
          setCurrPage={setCurrPage}
        />
      </div>
    </div>
  );
}
