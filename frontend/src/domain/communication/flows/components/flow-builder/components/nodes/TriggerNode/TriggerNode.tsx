import { Handle, Position } from "@xyflow/react";
import { ZapIcon } from "lucide-react";

import "./style.css";
import type { TriggerNodeProps } from "./TiggerNode.type";
import { NodeToolbar } from "../NodeToolbar.tsx";

export const TriggerNode = ({ data, id, sourcePosition }: TriggerNodeProps) => {
  return (
    <div className="trigger-node-container">
      <strong>
        <ZapIcon
          className="inline mr-1"
          width={ 14 }
          height={ 14 }
        />
        { data.label }
      </strong>
      <div>{ data.basicOutput?.name }</div>

      <NodeToolbar data={ data } id={ id } />
      <Handle
        type="source"
        position={ sourcePosition ?? Position.Bottom }
      />
    </div>
  );
};

export default TriggerNode;