import { useState } from "react";
import { Button } from "@shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@shared/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@shared/lib/utils";

export const Combobox = ({
  value,
  onValueChange,
  options,
  placeholder = "Select",
  searchPlaceholder = "Search...",
  emptyText = "No result.",
  className = "",
}: {
  value?: any;
  onValueChange: (v: string) => void;
  options: { label: string; value: any }[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={ open } onOpenChange={ setOpen }>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={ open }
          className={ cn("w-full justify-between", className) }
        >
          <span className="truncate">
            { value ? options.find((o) => o.value === value)?.label : placeholder }
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={ searchPlaceholder } />
          <CommandList>
            <CommandEmpty>{ emptyText }</CommandEmpty>
            <CommandGroup>
              { options.map((option) => (
                <CommandItem
                  key={ option.value }
                  value={ option.value }
                  onSelect={ () => {
                    onValueChange(option.value);
                    setOpen(false);
                  } }
                >
                  { option.label }
                  <Check
                    className={ cn(
                      "ml-auto",
                      value === option.value ? "opacity-100" : "opacity-0"
                    ) }
                  />
                </CommandItem>
              )) }
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};