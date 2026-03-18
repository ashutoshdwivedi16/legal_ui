import type { Node, NodeProps } from "@xyflow/react";

export interface ActionNodeOutputProps {
  selectedTemplateId: string;
  mapping: {
    value: string | null;
    templateVariable: string;
    isCustom: boolean;
  }[];
}

export interface ActionNodeBasicOutputProps {
  name: string;
}

export type ActionNodeDataProps = Node<{
  output: ActionNodeOutputProps;
  basicOutput: ActionNodeBasicOutputProps;
  label: string;
}>;

export type ActionNodeProps = NodeProps<ActionNodeDataProps>;
