// import { useParams, useNavigate } from 'react-router';
import { getTemplateList, removeTemplate } from "../../templates/api/templates.api";
import { formatDateTime } from "@shared/lib/date";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@shared/components/ui/input-group.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/components/ui/select.tsx";
import { Spinner } from "@shared/components/ui/spinner.tsx";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  SearchIcon,
  SquarePenIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import debounce from "lodash/debounce";
import { useRef, useState } from "react";
import { Button, buttonVariants } from "@shared/components/ui/button.tsx";
import { NavLink, useNavigate } from "react-router-dom";
import { PaginationControl } from "@core/components/PaginationControl";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@shared/components/ui/alert-dialog.tsx";
import { toast } from "sonner";

export const Templates = () => {
  // const {flowId} = useParams();
  const navigate = useNavigate();
  // if(!flowId) {
  //   navigate('../flows');
  // }
  const [query, setQuery] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const handleClear = () => {
    const el = searchInputRef.current; // fixes TS18047 by guarding null
    if (!el) return;
    el.value = "";        // change InputGroupInput value via ref
    setQuery("");         // keep app state in sync
    el.focus();           // optional UX improvement
  };

  const [selectVal, setSelectVal] = useState("all");
  const [sortVal, setSortVal] = useState("emailTemplateId,desc");
  const [currPage, setCurrPage] = useState(1);
  const { status, data, error, refetch } = useQuery({
    queryKey: ["templateList", { query, selectVal, sortVal, currPage }],
    queryFn: () => getTemplateList({ query, status: selectVal, sort: sortVal, page: currPage }),
    placeholderData: (prev) => prev,
  });
  const totalPage = data?.totalPages || 0;

  const templateList = data?.content || [];

  const removeTemplateMutation = useMutation({
    mutationFn: removeTemplate,
    onSuccess: () => {
      toast.success("Template deleted successfully");
      refetch();
    },
    onError: () => {
      toast.error("Failed to delete template. Something went wrong, please try again");
    },
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between">
        <h1 className="text-3xl font-bold mb-4">Email Templates</h1>
        <Button
          variant="destructive"
          onClick={ () => navigate("./new") }
        >Create New Template
        </Button>
      </div>
      <div
        className="flex items-center gap-2 mb-4"
        data-slot="search"
      >
        <InputGroup className="w-[360px]">
          <InputGroupInput
            placeholder="Search templates..."
            onChange={ debounce((e) => setQuery(e.target.value), 500) }
            ref={ searchInputRef }
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              // className="inline-flex items-center text-muted-foreground hover:text-foreground"
              onClick={ handleClear }
              size="icon-xs"
              aria-label="Clear"
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <Select
          defaultValue="all"
          value={ selectVal }
          onValueChange={ setSelectVal }
        >
          <SelectTrigger className="w-auto min-w-[120px]">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-[120px]">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select
          defaultValue="emailTemplateId"
          value={ sortVal }
          onValueChange={ setSortVal }
        >
          <SelectTrigger className="w-auto min-w-[120px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-[120px]">
            <SelectItem value="emailTemplateId,desc">Sort by: Template ID</SelectItem>
            <SelectItem value="updatedAt,desc">Sort by: Recently Edited</SelectItem>
            <SelectItem value="templateName">Sort by: Name</SelectItem>
          </SelectContent>
        </Select>
      </div>
      { status === "pending" && (
        <div className="flex justify-center items-center flex-1">
          <Spinner className="text-destructive size-10" />
        </div>
      ) }
      { status === "error" && <span>Error: { error.message }</span> }
      { status === "success" && (
        <>
          <Table className="mb-8">
            {/*<TableCaption>A list of your recent invoices.</TableCaption>*/ }
            <TableHeader>
              <TableRow>
                <TableHead className="p-4">Template Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Edited</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { templateList.map((row) => (
                <TableRow key={ row.emailTemplateId }>
                  <TableCell className="p-4">{ row.templateName }</TableCell>
                  <TableCell>
                    { row.status }
                  </TableCell>
                  <TableCell>{formatDateTime(row.updatedAt)}</TableCell>
                  <TableCell>
                    <NavLink to={ `./${ row.emailTemplateId }` }>
                      <Button
                        size="icon"
                        variant="ghost"
                      >
                        <SquarePenIcon />
                      </Button>
                    </NavLink>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2Icon className="text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete from our servers.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className={ buttonVariants({ variant: "destructive" }) }
                            onClick={ () => removeTemplateMutation.mutate(row.emailTemplateId) }
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              )) }
            </TableBody>
          </Table>
          <PaginationControl { ...{ totalPage, currPage, setCurrPage } } />
        </>
      ) }
    </div>
  );
};

export default Templates;