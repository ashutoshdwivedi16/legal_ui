import type { Node, NodeProps, Position } from "@xyflow/react";

export interface LogicNodeOutputProps {
  rules: string;
}

export type LogicNodeDataProps = Node<{
  output: LogicNodeOutputProps;
  label: string;
  description: string;
  fallbackPosition: Position;
}>;

export type LogicNodeProps = NodeProps<LogicNodeDataProps>;
