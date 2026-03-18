// src/nodes/CustomNode.jsx
import { nodeTypesEnum } from "../";
import useRootNodeData from "../../../hooks/useRootNodeData.tsx";
import { GitBranch } from "lucide-react";
import {
  Handle,
  Position,
  useNodeConnections,
  useReactFlow,
} from "@xyflow/react";
import "./style.css";
import { useEffect } from "react";
import type { LogicNodeProps } from "./LogicNode.type.ts";
import { NodeToolbar } from "../NodeToolbar.tsx";

const initialValues = {
  rules: [],
};

export const LogicNode = ({ data, sourcePosition, targetPosition, id }: LogicNodeProps) => {
  const targetConnections = useNodeConnections({
    handleType: "target",
  });
  const { updateNodeData } = useReactFlow();
  const { fallbackPosition } = data;
  const rootNodeData = useRootNodeData(id);

  const eventId = rootNodeData?.type === nodeTypesEnum.triggerNode && (rootNodeData?.data?.output as { selectedEventId?: string })?.selectedEventId;

  useEffect(() => {
    updateNodeData(id, () => ({ eventId }));
    if (!eventId)
      updateNodeData(id, () => ({ output: initialValues }));
  }, [eventId]);

  return (
    <div className="logic-node-container">
      <strong>
        <GitBranch
          className="inline mr-1"
          width={ 14 }
          height={ 14 }
        />
        { data.label }
      </strong>
      <div>{ data.basicOutput?.name }</div>

      <NodeToolbar data={ data } id={ id } />
      <Handle
        type="target"
        position={ targetPosition ?? Position.Top }
        isConnectable={ targetConnections.length < 1 }
      />
      <Handle
        type="source"
        position={ fallbackPosition ?? Position.Right }
        className="bg-red-100! w-5! h-5! text-center"
        id="fallback-handle"
      >F
      </Handle>
      <Handle
        type="source"
        position={ sourcePosition ?? Position.Bottom }
        className="bg-green-100! w-5! h-5! text-center"
        id="handle"
      >T
      </Handle>
    </div>
  );
};

export default LogicNode;