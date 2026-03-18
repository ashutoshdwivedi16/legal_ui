import { getFlowList, removeFlow } from "../../flows/api/flows.api";
import { Badge } from "@shared/components/ui/badge.tsx";
import { Button, buttonVariants } from "@shared/components/ui/button.tsx";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@shared/components/ui/card.tsx";
import { Item, ItemContent, ItemTitle } from "@shared/components/ui/item.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/select";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@shared/components/ui/input-group.tsx";
import { Separator } from "@shared/components/ui/separator.tsx";
import { Spinner } from "@shared/components/ui/spinner.tsx";
import debounce from "lodash/debounce";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronRightIcon, SearchIcon, SquarePenIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@shared/components/ui/alert-dialog.tsx";
import { PaginationControl } from "@core/components/PaginationControl";
import { toast } from "sonner";

export const Flows = () => {
  const navigate = useNavigate();
  const [, setQuery] = useState("");
  const [selectVal, setSelectVal] = useState("all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [currPage, setCurrPage] = useState(1);
  const { status, data, error, refetch } = useQuery({
    queryKey: ["flowList", { currPage }],
    queryFn: () => getFlowList({ page: currPage }),
  });
  const totalPage = data?.totalPages || 0;

  const flowList = data?.content || [];
  const handleClear = () => {
    const el = searchInputRef.current; // fixes TS18047 by guarding null
    if (!el) return;
    el.value = "";        // change InputGroupInput value via ref
    setQuery("");         // keep app state in sync
    el.focus();           // optional UX improvement
  };

  const removeFlowMutation = useMutation({
    mutationFn: removeFlow,
    onSuccess: () => {
      toast.success("Flow deleted successfully");
      refetch();
    },
    onError: () => {
      toast.error("Failed to delete flow. Please try again");
    },
  });

  /*  const enableFlowMutation = useMutation({
    mutationFn: enableFlow,
    onSuccess: (data) => {
      console.log("enableFlowMutation success", data);
    },
    onError: (error) => {
      console.error("enableFlowMutation error", error);
    },
  })*/

  console.log("debug render", data);
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold mb-4">Flows</h1>
        <Button
          variant="destructive"
          onClick={ () => navigate("./new") }
        >Create New Flow
        </Button>
      </div>
      <div
        className="flex items-center gap-2 mb-4"
        data-slot="search"
      >
        <InputGroup className="w-[360px]">
          <InputGroupInput
            placeholder="Search..."
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
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>
      { status === "pending" && (
        <div className="flex justify-center items-center h-full w-full">
          <Spinner className="text-destructive size-10" />
        </div>
      ) }
      { status === "error" && <span>Error: { error.message }</span> }
      { status === "success" && (
        <div className="">
          { flowList.map((item) => (
            <Card className="mb-4" key={ item.flowId }>
              <CardHeader>
                <CardTitle>{ item.name }</CardTitle>
                <CardDescription>
                  { item.description }
                </CardDescription>
                <CardAction>
                  <div className="flex items-center space-x-2">
                    <Badge
                      className={ `capitalize ${ item.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700" }` }
                    >{ item.status }
                    </Badge>
                    {/*<Switch*/ }
                    {/*  className="data-[state=checked]:bg-destructive"*/ }
                    {/*  checked={ item.status === "ACTIVE" }*/ }
                    {/*  onCheckedChange={ (value) => {*/ }
                    {/*    if (!enableFlowMutation.isPending)*/ }
                    {/*      enableFlowMutation.mutate({*/ }
                    {/*        flowId: item.flowId,*/ }
                    {/*        value,*/ }
                    {/*      })*/ }
                    {/*  } }*/ }
                    {/*/>*/ }
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <Item className="flex-1 bg-gray-100 text-gray-700">
                    <ItemContent>
                      <ItemTitle>TOTAL</ItemTitle>
                      <p className="text-3xl font-medium">
                        { item?.executionAnalytics?.totalFlowExecutions }
                      </p>
                      <p>All transactions</p>
                    </ItemContent>
                  </Item>
                  <Item className="flex-1 bg-sky-50 text-sky-700">
                    <ItemContent>
                      <ItemTitle>ACTIVE</ItemTitle>
                      <p className="text-3xl font-medium">
                        { item?.executionAnalytics?.runningCount }
                      </p>
                      <p>In progress</p>
                    </ItemContent>
                  </Item>
                  <Item className="flex-1 bg-green-50 text-green-700">
                    <ItemContent>
                      <ItemTitle>COMPLETED</ItemTitle>
                      <p className="text-3xl font-medium">
                        { item?.executionAnalytics?.completedCount }
                      </p>
                      <p>Finished</p>
                    </ItemContent>
                  </Item>
                  <Item className="flex-1 bg-red-50 text-red-700">
                    <ItemContent>
                      <ItemTitle>FAILED</ItemTitle>
                      <p className="text-3xl font-medium">
                        { item?.executionAnalytics?.failedCount }
                      </p>
                      <p>Errors</p>
                    </ItemContent>
                  </Item>
                </div>
                <Separator />
              </CardContent>
              <CardFooter className="flex justify-between">
                <NavLink to={ `../transactions/${ item.flowId }` }>
                  <Button
                    variant="link"
                    className="text-destructive"
                  >

                  View All Transactions
                    <ChevronRightIcon />
                  </Button>
                </NavLink>
                <div className="flex gap-2">
                  <NavLink to={ `./${ item.flowId }` }>
                    <Button variant="outline">
                      <SquarePenIcon />
                    Edit
                    </Button>
                  </NavLink>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                      >
                        <Trash2Icon />
                      Delete
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
                          onClick={ () => removeFlowMutation.mutate(item.flowId) }
                        >
                        Continue
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardFooter>
            </Card>
          )) }
          <PaginationControl { ...{ totalPage, currPage, setCurrPage } } />
        </div>
      ) }
    </div>

  );
};

export default Flows;