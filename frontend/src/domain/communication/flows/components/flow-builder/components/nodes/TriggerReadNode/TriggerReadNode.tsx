import { Handle, Position } from "@xyflow/react";
import { ZapIcon } from "lucide-react";
import "../readNodeStyle.css";
import "./style.css";
import type { TriggerNodeProps } from "./TiggerNode.type";

export const TriggerReadNode = ({ data, sourcePosition }: TriggerNodeProps) => {
  return (
    <div className="read-node-container trigger-read-node-container">
      <strong>
        <ZapIcon
          className="inline mr-1"
          width={14}
          height={14}
        />
        {data.label}
      </strong>
      <div>{data.description}</div>
      <Handle
        type="source"
        position={sourcePosition ?? Position.Bottom}
        isConnectable={false}
      />
    </div>
  );
};

export default TriggerReadNode;
