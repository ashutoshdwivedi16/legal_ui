import type { Edge, Node } from "@xyflow/react";
import dagre from "@dagrejs/dagre";

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "TB") => {
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction, ranksep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: node?.measured?.width || 200, height: node?.measured?.height || 200 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      data: {
        ...node.data,
        fallbackPosition: isHorizontal ? "bottom" : "right",
      },
      targetPosition: isHorizontal ? "left" : "top",
      sourcePosition: isHorizontal ? "right" : "bottom",
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      },
    };

    return newNode;
  });

  return { nodes: newNodes, edges };
};