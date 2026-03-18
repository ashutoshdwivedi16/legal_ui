import { useReactFlow, useNodesData, useOnSelectionChange, type Node } from "@xyflow/react";
import { useState } from "react";
import { nodeTypesEnum } from "./nodes";
import { TriggerNodeDetails } from "./nodes/TriggerNode/TriggerNodeDetails.tsx";
import { LogicNodeDetails } from "./nodes/LogicNode/LogicNodeDetails.tsx";
import { ActionNodeDetails } from "./nodes/ActionNode/ActionNodeDetails.tsx";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@shared/components/ui/drawer.tsx";
import { XIcon } from "lucide-react";

export function PropertyBar() {
  const { setNodes } = useReactFlow();
  const [selectedNodesId, setSelectedNodesId] = useState<string | null>(null);

  const onChange = ({ nodes }: { nodes: Node[] }) => {
    setSelectedNodesId(nodes[0]?.id || null);
  };

  useOnSelectionChange({
    onChange,
  });

  const nodeData = selectedNodesId ? useNodesData(selectedNodesId) : null;

  // if (!selectedNodeData) return null;
  const nodeType = nodeData?.type;

  const unselectNodeById = (id: string | null) => {
    if (!id) return;
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, selected: false } : n)));
  };

  const componentData = nodeData ? {
    data: nodeData.data as Record<string, unknown>,
    id: nodeData.id,
  } : null;

  return (
    <Drawer
      direction="right"
      open={ !!nodeType }
      onClose={ () => unselectNodeById(selectedNodesId) }
    >
      <DrawerContent>
        <DrawerHeader>
          <div className="relative">
            <DrawerTitle>Node Properties</DrawerTitle>
            <DrawerDescription>
              {/*Set your daily activity goal.*/}
            </DrawerDescription>
            <DrawerClose asChild>
              <XIcon className="absolute right-0 top-0" aria-label="Close" />
            </DrawerClose>
          </div>
        </DrawerHeader>
        <div className="overflow-y-auto p-4">
          { componentData && nodeType === nodeTypesEnum.triggerNode && <TriggerNodeDetails data={ componentData } /> }
          { componentData && nodeType === nodeTypesEnum.logicNode && <LogicNodeDetails data={ componentData } /> }
          { componentData && nodeType === nodeTypesEnum.actionNode && <ActionNodeDetails data={ componentData } /> }
        </div>
      </DrawerContent>
    </Drawer>
  );
}
