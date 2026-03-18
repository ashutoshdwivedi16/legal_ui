import { GitBranch } from "lucide-react";
import {
  Handle,
  Position,
  useNodeConnections,
} from "@xyflow/react";
import "../readNodeStyle.css";
import "./style.css";
import type { LogicNodeProps } from "./LogicNode.type.ts";

export const LogicNode = ({ data, sourcePosition, targetPosition, id }: LogicNodeProps) => {
  const targetConnections = useNodeConnections({
    handleType: "target",
  });
  const { fallbackPosition } = data;

  return (
    <div className="read-node-container logic-read-node-container">
      <strong>
        <GitBranch
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
      <Handle
        type="source"
        position={fallbackPosition ?? Position.Right}
        isConnectable={false}
        className="bg-red-100! w-5! h-5! text-center"
        id={`${id}-fallback-handle`}
      >F
      </Handle>
      <Handle
        type="source"
        position={sourcePosition ?? Position.Bottom}
        isConnectable={false}
        className="bg-green-100! w-5! h-5! text-center"
        id={`${id}-handle`}
      >T
      </Handle>
    </div>
  );
};

export default LogicNode;
