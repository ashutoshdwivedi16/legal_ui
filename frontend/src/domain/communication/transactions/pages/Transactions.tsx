import { useNavigate, useParams } from "react-router-dom";
import { getTransactionAnalytics, getTransactionList, type Transaction } from "../../transactions/api/transactions.api";
import { getEventGroups } from "../../flows/api/flows.api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shared/components/ui/table.tsx";
import { Badge } from "@shared/components/ui/badge.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/components/ui/select.tsx";
import { Spinner } from "@shared/components/ui/spinner.tsx";
import { useQuery } from "@tanstack/react-query";
import { CircleCheckBigIcon, CircleIcon, CircleXIcon } from "lucide-react";
import { useState } from "react";
import { PaginationControl } from "@core/components/PaginationControl";
import { Item, ItemContent, ItemTitle } from "@shared/components/ui/item.tsx";

const StatusBadge = ({ status}: { status: string }) => {
  return (
    <>
      { status === "Completed" && (
        <Badge
          variant="secondary"
          className="bg-green-50 text-green-700"
        >
          <CircleCheckBigIcon />
          { status }
        </Badge>
      )}
      { status === "Active" && (
        <Badge
          variant="secondary"
          className="bg-sky-50 text-sky-700"
        >
          <CircleIcon />
          { status }
        </Badge>
      )}
      { status === "Failed" && (
        <Badge
          variant="secondary"
          className="bg-red-50 text-red-700"
        >
          <CircleXIcon />
          { status }
        </Badge>
      )}

    </>
  );
};

export const Transactions = () => {
  const { flowId } = useParams();
  // const navigate = useNavigate();
  // if(!flowId) {
  //   navigate('../flows');
  // }
  const navigate = useNavigate();

  const [eventGroupId, setEventGroupId] = useState("");

  const { data: eventGroupsData } = useQuery({
    queryKey: ["getEventGroups"],
    queryFn: () => getEventGroups(),
    enabled: !flowId,
  });

  const selectedEventGroupId =
    !flowId ? eventGroupId || eventGroupsData?.[0]?.eventGroupId || "" : "";
  // const [query, setQuery] = useState("");
  // const [selectVal, setSelectVal] = useState("all");
  // const [selectTimeVal, setSelectTimeVal] = useState("all");
  const [currPage, setCurrPage] = useState(1);
  const { status, data, error } = useQuery({
    queryKey: ["transactionList", { flowId, selectedEventGroupId, currPage }],
    queryFn: () => getTransactionList({ flowId: flowId, eventGroupId: selectedEventGroupId, page: currPage }),
    placeholderData: (prev) => prev,
    enabled: !!flowId || !!selectedEventGroupId,
  });

  const { status: transactionAnalyticsStatus, data: transactionAnalyticsData } = useQuery({
    queryKey: ["transactionAnalytics", { flowId, selectedEventGroupId }],
    queryFn: () => getTransactionAnalytics({ flowId: flowId, eventGroupId: selectedEventGroupId }),
    enabled: !!flowId || !!selectedEventGroupId,
  });
  const totalPage = data?.totalPages || 0;

  const transactionListData = data?.content;
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">All Transactions</h2>
      <p className="text-muted-foreground text-sm mb-4">{ transactionListData?.length } transaction(s) found</p>
      {transactionAnalyticsStatus === "success" && (
        <div className="flex gap-4 mb-8">
          <Item className="flex-1 bg-gray-100 text-gray-700">
            <ItemContent>
              <ItemTitle>TOTAL</ItemTitle>
              <p className="text-3xl font-medium">
                { transactionAnalyticsData?.totalFlowExecutions }
              </p>
              <p>All transactions</p>
            </ItemContent>
          </Item>
          <Item className="flex-1 bg-sky-50 text-sky-700">
            <ItemContent>
              <ItemTitle>ACTIVE</ItemTitle>
              <p className="text-3xl font-medium">
                { transactionAnalyticsData?.runningCount }
              </p>
              <p>In progress</p>
            </ItemContent>
          </Item>
          <Item className="flex-1 bg-green-50 text-green-700">
            <ItemContent>
              <ItemTitle>COMPLETED</ItemTitle>
              <p className="text-3xl font-medium">
                { transactionAnalyticsData?.completedCount }
              </p>
              <p>Finished</p>
            </ItemContent>
          </Item>
          <Item className="flex-1 bg-red-50 text-red-700">
            <ItemContent>
              <ItemTitle>FAILED</ItemTitle>
              <p className="text-3xl font-medium">
                { transactionAnalyticsData?.failedCount }
              </p>
              <p>Errors</p>
            </ItemContent>
          </Item>
        </div>
      )}
      <div
        className="flex items-center gap-2 mb-4"
        data-slot="search"
      >
        { !flowId && (
          <Select
            value={ selectedEventGroupId }
            onValueChange={ setEventGroupId }
          >
            <SelectTrigger className="w-auto min-w-[120px]">
              <SelectValue placeholder="Select Event Group" />
            </SelectTrigger>
            <SelectContent className="w-auto min-w-[120px]">
              { eventGroupsData?.map((item) => (
                <SelectItem key={item.eventGroupId} value={ item.eventGroupId }>{ item.name }</SelectItem>
              )) }
            </SelectContent>
          </Select>
        ) }
        { /*        <InputGroup className="w-[360px]">
          <InputGroupInput
            placeholder="Search by email or phone..."
            type="search"
            onChange={ debounce((e) => setQuery(e.target.value), 500) }
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>*/ }
        {/* <Select
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
        </Select>*/}
        { /*<Select*/ }
        { /*  defaultValue="all"*/ }
        { /*  value={ selectTimeVal }*/ }
        { /*  onValueChange={ setSelectTimeVal }*/ }
        { /*>*/ }
        { /*  <SelectTrigger className="w-auto min-w-[120px]">*/ }
        { /*    <SelectValue placeholder="Select time" />*/ }
        { /*  </SelectTrigger>*/ }
        { /*  <SelectContent className="w-auto min-w-[120px]">*/ }
        { /*    <SelectItem value="all">All Time</SelectItem>*/ }
        { /*    <SelectItem value="today">Today</SelectItem>*/ }
        { /*    <SelectItem value="week">This week</SelectItem>*/ }
        { /*    <SelectItem value="month">This Month</SelectItem>*/ }
        { /*  </SelectContent>*/ }
        { /*</Select>*/ }
      </div>
      { !!flowId || !!eventGroupId && (
        <>
          { status === "pending" && (
            <div className="flex justify-center items-center flex-1">
              <Spinner className="text-destructive size-10" />
            </div>
          ) }
          { status === "error" && <span>Error: { error.message }</span> }
          { status === "success" && (
            <>
              <Table className="mb-8">
                { /*<TableCaption>A list of your recent invoices.</TableCaption>*/ }
                <TableHeader>
                  <TableRow>
                    <TableHead className="p-4">IDENTIFIER (EMAIL)</TableHead>
                    <TableHead>PHONE</TableHead>
                    <TableHead>STATUS</TableHead>
                    <TableHead>STARTED</TableHead>
                    <TableHead>COMPLETED</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  { transactionListData?.map((row: Transaction) => (
                    <TableRow
                      key={ row.flowId }
                      onClick={ () => {
                        navigate(`/transactions/details/${ row.flowId }`);
                      } }
                      className="cursor-pointer"
                    >
                      <TableCell className="p-4">
                        <StatusBadge status={ row.status } />
                      </TableCell>
                    </TableRow>
                  )) }
                </TableBody>
              </Table>
              <PaginationControl { ...{ totalPage, currPage, setCurrPage } } />
            </>
          ) }
        </>
      ) }
    </div>
  );
};

export default Transactions;