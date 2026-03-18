import type { Node, NodeProps } from "@xyflow/react";

export interface ActionNodeOutputProps {
  selectedTemplateId: string;
  mapping: {
    value: string;
    templateVariable: string;
    isCustom: boolean;
  }[];
}

export type ActionNodeDataProps = Node<{
  output: ActionNodeOutputProps;
  label: string;
  description: string;
}>;

export type ActionNodeProps = NodeProps<ActionNodeDataProps>;
