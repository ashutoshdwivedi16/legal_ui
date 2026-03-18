import { useNodesData, useOnSelectionChange, type Node } from "@xyflow/react";
import { useCallback, useState } from "react";
import { nodeTypesEnum } from "./nodes";
import { TriggerReadNodeDetails } from "./nodes/TriggerReadNode/TriggerReadNodeDetails.tsx";
import { LogicReadNodeDetails } from "./nodes/LogicReadNode/LogicReadNodeDetails.tsx";
import { ActionReadNodeDetails } from "./nodes/ActionReadNode/ActionReadNodeDetails.tsx";

export function ExecutionDetailsBar() {
  const [selectedNodes, setSelectedNodes] = useState("");

  const onChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    setSelectedNodes(nodes[0]?.id || "");
  }, []);

  useOnSelectionChange({
    onChange,
  });

  const nodeData = useNodesData(selectedNodes);

  if (!nodeData) return null;
  const nodeType = nodeData?.type;

  const componentData = {
    data: nodeData.data as Record<string, unknown>,
    id: nodeData.id,
  };

  return (
    <aside className="p-4 max-w-100">
      <div className="font-semibold text-lg mb-4 text-nowrap">
        Execution Details
      </div>
      { nodeType === nodeTypesEnum.triggerNode && <TriggerReadNodeDetails data={ componentData } /> }
      { nodeType === nodeTypesEnum.logicNode && <LogicReadNodeDetails data={ componentData } /> }
      { nodeType === nodeTypesEnum.actionNode && <ActionReadNodeDetails data={ componentData } /> }
    </aside>
  );
}
