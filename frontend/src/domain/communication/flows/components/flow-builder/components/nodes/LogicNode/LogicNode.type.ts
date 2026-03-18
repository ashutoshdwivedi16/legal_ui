import type { Node, NodeProps, Position } from "@xyflow/react";

export interface LogicNodeOutputProps {
  rules: string;
}

export interface LogicNodeBasicOutputProps {
  name: string;
}

export type LogicNodeDataProps = Node<{
  output: LogicNodeOutputProps;
  basicOutput: LogicNodeBasicOutputProps;
  label: string;
  fallbackPosition: Position;
}>;

export type LogicNodeProps = NodeProps<LogicNodeDataProps>;
