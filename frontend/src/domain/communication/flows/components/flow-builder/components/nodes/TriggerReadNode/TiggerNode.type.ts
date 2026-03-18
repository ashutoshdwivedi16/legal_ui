import type { Node, NodeProps } from "@xyflow/react";

export interface TriggerNodeOutputProps {
  selectedEventId: string;
}

export type TriggerNodeDataProps = Node<{
  output: TriggerNodeOutputProps;
  label: string;
  description: string;
  options: {
    value: string;
    label: string;
  }[];
}>;

export type TriggerNodeProps = NodeProps<TriggerNodeDataProps>;