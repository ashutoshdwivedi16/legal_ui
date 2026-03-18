import { getReport } from "../../reports/api/reports.api";
import { Button } from "@shared/components/ui/button.tsx";
import { Card, CardContent, CardDescription } from "@shared/components/ui/card.tsx";
import { Spinner } from "@shared/components/ui/spinner.tsx";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/components/ui/popover.tsx";
import { Calendar } from "@shared/components/ui/calendar.tsx";
import type { DateRange } from "react-day-picker";

export const Reports = () => {
  const today = new Date();
  const [query, setQuery] = useState<{ query?: string; range?: DateRange | undefined }>({
    query: "week",
    range: { from: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), to: today },
  });
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>(undefined);
  const { status, data, error } = useQuery({
    queryKey: ["reports", { query }],
    queryFn: () => getReport({ range: query?.range as { from: Date; to: Date } }),
    enabled: !!query?.range?.from,
  });
  const stats = data?.[0]?.stats?.[0]?.metrics as Record<string, number> | undefined;
  console.log("debug render", data, stats);
  const format = (d?: Date) =>
    d ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";

  return (
    <div className="h-full flex flex-col">
      <div className="">
        <h1 className="text-2xl font-bold mb-4">Email Activity Reports</h1>
        <p className="mb-4">Monitor email performance metrics and campaign analytics</p>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <Popover
          open={popoverOpen}
          onOpenChange={(stat) => {
            setTempRange(query.range);
            setPopoverOpen(stat);
          }}
        >
          <PopoverTrigger asChild>
            <Button variant={query.range?.from ? "destructive" : "outline"}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {query.range?.from
                ? `${format(query.range.from)}${query.range.to ? " — " + format(query.range.to) : ""}`
                : "Pick a date range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <Calendar
              mode="range"
              selected={tempRange}
              onSelect={setTempRange}
              numberOfMonths={1}
              weekStartsOn={1}
              captionLayout="dropdown"
            />
            <div className="flex w-full gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setPopoverOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-700 flex-1"
                onClick={() => {
                  setQuery(() => ({ range: tempRange }));
                  setPopoverOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {!!query?.range?.from && (
        <>
          {status === "pending" && (
            <div className="flex justify-center items-center h-full w-full">
              <Spinner className="text-destructive size-10" />
            </div>
          )}
          {status === "error" && <span>Error: {error.message}</span>}
          {status === "success" && (
            <div className="grid grid-cols-4 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-4">
              {stats &&
                Object.keys(stats).map((key) => {
                  return (
                    <Card key={key}>
                      <CardContent>
                        <CardDescription className="mb-2 capitalize">{key}</CardDescription>
                        <p className="text-2xl font-semibold">{stats[key].toLocaleString()}</p>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
