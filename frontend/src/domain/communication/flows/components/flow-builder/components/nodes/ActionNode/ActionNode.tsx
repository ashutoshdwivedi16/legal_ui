import { nodeTypesEnum } from "../";
import useRootNodeData from "../../../hooks/useRootNodeData.tsx";
import {
  Handle, Position, useNodeConnections, useReactFlow,
} from "@xyflow/react";
import "./style.css";
import type { ActionNodeProps } from "./ActionNode.type";
import { useEffect } from "react";
import { MailIcon } from "lucide-react";
import { NodeToolbar } from "../NodeToolbar.tsx";

export const ActionNode = ({ data, sourcePosition: _sourcePosition, targetPosition, id }: ActionNodeProps) => {
  const targetConnections = useNodeConnections({
    handleType: "target",
  });
  const { updateNodeData } = useReactFlow();

  const rootNodeData = useRootNodeData(id);

  const eventId = rootNodeData?.type === nodeTypesEnum.triggerNode && (rootNodeData?.data?.output as { selectedEventId?: string })?.selectedEventId;

  useEffect(() => {
    updateNodeData(id, () => ({ eventId }));
    if (!eventId)
      updateNodeData(id, () => ({ output: {} }));
  }, [eventId]);

  return (
    <div className="action-node-container">
      <strong>
        <MailIcon
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
    </div>
  );
};

export default ActionNode;