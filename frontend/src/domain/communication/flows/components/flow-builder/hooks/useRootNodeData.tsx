import { useEdges, useNodesData } from "@xyflow/react";
import type { Edge } from "@xyflow/react";

export const useRootNodeData = (nodeId: string | null) => {
  const edges: Edge[] = useEdges();
  let currentId: string | null = nodeId;
  let parentId = nodeId ? edges.find(edge => edge.target === nodeId)?.source : undefined;

  while (parentId) {
    currentId = parentId;
    parentId = edges.find(edge => edge.target === currentId)?.source;
  }

  return useNodesData(currentId || "");
};

export default useRootNodeData;
