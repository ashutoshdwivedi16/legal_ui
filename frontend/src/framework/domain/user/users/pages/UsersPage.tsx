import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, flexRender } from "@tanstack/react-table";
import type { ColumnDef, SortingState, RowSelectionState, VisibilityState, Column } from "@tanstack/react-table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getUsers, deleteUser, deleteUsers } from "../api/users.api";
import type { User } from "../api/users.api";
import { Button, buttonVariants } from "@shared/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@shared/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Checkbox } from "@shared/components/ui/checkbox";
import { Badge } from "@shared/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shared/components/ui/dropdown-menu";
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
} from "@shared/components/ui/alert-dialog";
import { PaginationControl } from "@core/components/PaginationControl";
import { Spinner } from "@shared/components/ui/spinner";
import { AccessDenied } from "@shared/components/AccessDenied";
import { ServerError } from "@shared/components/ServerError";
import { toast } from "sonner";
import {
  SearchIcon,
  XIcon,
  UserPlusIcon,
  Trash2Icon,
  ChevronDown,
  RotateCcwIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
  EyeIcon,
  SquarePenIcon,
} from "lucide-react";
import debounce from "lodash/debounce";
import type { AxiosError } from "axios";
import { usePermissionStore } from "@core/auth/stores/permissionStore";

const COLUMN_VISIBILITY_KEY = "users-page-column-visibility";

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

export default function UsersPage() {
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
  const canCreate = hasPermission('admin.users:create');
  const canUpdate = hasPermission('admin.users:update');
  const canDelete = hasPermission('admin.users:delete');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const handleClear = () => {
    const el = searchInputRef.current;
    if (!el) return;
    el.value = "";
    setQuery("");
    el.focus();
  };

  useEffect(() => {
    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  const sortParam = sorting.length > 0
    ? `${sorting[0].id},${sorting[0].desc ? "desc" : "asc"}`
    : undefined;

  const { status, data, error, refetch } = useQuery({
    queryKey: ["users", { query, statusFilter, currPage, sortParam }],
    queryFn: () => getUsers({ query, status: statusFilter, page: currPage - 1, size: 10, sort: sortParam }),
    placeholderData: (prev) => prev,
    retry: false,
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      toast.success("User deleted successfully");
      refetch();
    },
    onError: () => {
      toast.error("Failed to delete user");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: deleteUsers,
    onSuccess: (_, deletedIds) => {
      toast.success(`${deletedIds.length} user(s) deleted successfully`);
      setRowSelection({});
      refetch();
    },
    onError: () => {
      toast.error("Failed to delete users");
    },
  });

  const handleDeleteUser = useCallback((id: number) => {
    deleteUserMutation.mutate(id);
  }, [deleteUserMutation]);

  const columns = useMemo<ColumnDef<User>[]>(() => [
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
      accessorKey: "email",
      header: ({ column }) => <SortableHeader column={column}>Email</SortableHeader>,
      cell: ({ row }) => row.getValue("email"),
    },
    {
      id: "name",
      accessorFn: (row) => `${row.firstName || ""} ${row.lastName || ""}`.trim(),
      header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
      cell: ({ row }) => {
        const firstName = row.original.firstName;
        const lastName = row.original.lastName;
        return firstName || lastName ? `${firstName || ""} ${lastName || ""}`.trim() : "—";
      },
      enableSorting: false,
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
      accessorKey: "roles",
      header: "Roles",
      cell: ({ row }) => {
        const roles = row.original.roles;
        return roles?.length > 0 ? (
          <div className="flex gap-1 flex-wrap">
            {roles.map((role) => (
              <Badge key={role.id} variant="outline" className="text-xs">{role.name}</Badge>
            ))}
          </div>
        ) : <span className="text-muted-foreground text-sm">—</span>;
      },
      enableSorting: false,
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
                    <AlertDialogTitle>Delete User?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this user? This action cannot be undone and will permanently remove the user from the system.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className={buttonVariants({ variant: "destructive" })}
                      onClick={() => handleDeleteUser(row.original.id)}
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
  ], [handleDeleteUser, canUpdate, canDelete]);

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
      setBulkDeleteOpen(false);
    } catch {
    }
  };

  const selectedCount = Object.keys(rowSelection).length;

  const errorStatus = error ? (error as AxiosError).response?.status : undefined;

  if (errorStatus === 403) {
    return <AccessDenied description="You do not have permission to view users." />;
  }
  if (errorStatus && errorStatus >= 500) {
    return <ServerError message="Failed to load users. Please try again later." />;
  }

  const tableControls = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <InputGroup className="w-[360px]">
          <InputGroupInput
            placeholder="Search users..."
            onChange={debounce((e) => setQuery(e.target.value), 500)}
            ref={searchInputRef}
          />
          <InputGroupAddon><SearchIcon /></InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <InputGroupButton onClick={handleClear} size="icon-xs" aria-label="Clear">
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
            <SelectItem value="all">All Users</SelectItem>
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
          <h1 className="text-3xl font-bold">Users</h1>
          {canCreate && (
            <Button onClick={() => navigate("./new")}>
              <UserPlusIcon className="mr-2 h-4 w-4" />
              Add User
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
        <h1 className="text-3xl font-bold">Users</h1>
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
                  <AlertDialogTitle>Delete {selectedCount} User(s)?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedCount} selected user(s)? This action cannot be undone and will permanently remove them from the system.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className={buttonVariants({ variant: "destructive" })}
                    onClick={executeBulkDelete}
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
              <UserPlusIcon className="mr-2 h-4 w-4" />
              Add User
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

export { UsersPage };
