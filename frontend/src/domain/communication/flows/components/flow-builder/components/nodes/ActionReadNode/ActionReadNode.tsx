import { nodeTypesEnum } from "../";
import useRootNodeData from "../../../hooks/useRootNodeData.tsx";
import {
  Handle, Position, useNodeConnections, useNodeId, useReactFlow,
} from "@xyflow/react";
import "../readNodeStyle.css";
import "./style.css";
import type { ActionNodeProps } from "./ActionNode.type";
import { useEffect } from "react";
import { MailIcon } from "lucide-react";

export const ActionNode = ({ data, targetPosition, id }: ActionNodeProps) => {
  const targetConnections = useNodeConnections({
    handleType: "target",
  });
  const { updateNodeData } = useReactFlow();
  const rootNodeData = useRootNodeData(useNodeId());
  const eventId = rootNodeData?.type === nodeTypesEnum.triggerNode && (rootNodeData?.data?.output as { selectedEventId?: string })?.selectedEventId;

  useEffect(() => {
    if (!eventId)
      updateNodeData(id, () => ({ output: {} }));
  }, [eventId, id, updateNodeData]);

  return (
    <div className="read-node-container action-read-node-container">
      <strong>
        <MailIcon
          className="inline mr-1"
          width={14}
          height={14}
        />
        {data.label}
      </strong>
      <div>{data.description}</div>
      <Handle
        type="target"
        position={targetPosition ?? Position.Top}
        isConnectable={targetConnections.length < 1}
      />
    </div>
  );
};

export default ActionNode;
