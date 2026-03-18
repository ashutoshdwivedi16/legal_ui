import type { Node, NodeProps } from "@xyflow/react";

export interface TriggerNodeOutputProps {
  selectedEventId: string;
}

export interface TriggerNodeBasicOutputProps {
  name: string;
  description: string;
}

export type TriggerNodeDataProps = Node<{
  output: TriggerNodeOutputProps;
  basicOutput: TriggerNodeBasicOutputProps;
  label: string;
  options: {
    value: string;
    label: string;
  }[];
}>;

export type TriggerNodeProps = NodeProps<TriggerNodeDataProps>;