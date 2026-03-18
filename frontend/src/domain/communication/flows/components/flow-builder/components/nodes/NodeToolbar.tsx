import { Button } from "@/shared/components/ui/button";
import { useReactFlow } from "@xyflow/react";
import { XIcon } from "lucide-react";

interface NodeToolbarProps {
  data: unknown;
  id: string;
}

export const NodeToolbar = ({ id }: NodeToolbarProps) => {
  const { deleteElements } = useReactFlow();

  const deleteHandler = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <div className="absolute top-0 right-0">
      <Button
        className="rounded-full size-4 translate-x-1/2 -translate-y-1/2"
        size="icon-sm"
        variant="destructive"
        onClick={deleteHandler}
      >
        <XIcon className="size-3" />
      </Button>
    </div>
  );
};

export default NodeToolbar;
