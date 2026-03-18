import { Button } from "@shared/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

interface PaginationControlProps {
  totalPage: number;
  currPage: number;
  setCurrPage: (page: number) => void;
}

export function PaginationControl({ totalPage, currPage, setCurrPage }: PaginationControlProps) {
  if (totalPage <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <Button
        variant="outline"
        size="icon"
        disabled={currPage <= 1}
        onClick={() => setCurrPage(currPage - 1)}
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {currPage} of {totalPage}
      </span>
      <Button
        variant="outline"
        size="icon"
        disabled={currPage >= totalPage}
        onClick={() => setCurrPage(currPage + 1)}
      >
        <ChevronRightIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
