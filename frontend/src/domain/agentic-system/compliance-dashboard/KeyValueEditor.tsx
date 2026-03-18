import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Checkbox } from "@/shared/components/ui/checkbox";
import type { KeyValuePair } from "./postman-types";

interface KeyValueEditorProps {
  items: KeyValuePair[];
  onChange: (items: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addButtonText?: string;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function KeyValueEditor({
  items,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  addButtonText = "Add",
}: KeyValueEditorProps) {
  const handleAdd = () => {
    onChange([...items, { id: generateId(), key: "", value: "", enabled: true }]);
  };

  const handleRemove = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const handleChange = (id: string, field: "key" | "value", newValue: string) => {
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, [field]: newValue } : item
      )
    );
  };

  const handleToggle = (id: string) => {
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <Checkbox
            checked={item.enabled}
            onCheckedChange={() => handleToggle(item.id)}
            className="shrink-0"
          />
          <Input
            value={item.key}
            onChange={(e) => handleChange(item.id, "key", e.target.value)}
            placeholder={keyPlaceholder}
            className={`flex-1 ${!item.enabled ? "opacity-50" : ""}`}
          />
          <Input
            value={item.value}
            onChange={(e) => handleChange(item.id, "value", e.target.value)}
            placeholder={valuePlaceholder}
            className={`flex-1 ${!item.enabled ? "opacity-50" : ""}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleRemove(item.id)}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="mt-2"
      >
        <Plus className="h-4 w-4 mr-1" />
        {addButtonText}
      </Button>
    </div>
  );
}
