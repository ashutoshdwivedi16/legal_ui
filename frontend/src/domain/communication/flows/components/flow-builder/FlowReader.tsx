import { useCallback, useEffect } from "react";
import {
  Background,
  ReactFlow,
  ConnectionLineType,
  Panel,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useNodesInitialized,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./App.css";

import { ExecutionDetailsBar } from "./components/ExecutionDetailsBar.tsx";

import { flowReaderNodeTypes } from "./components/nodes";
import { getLayoutedElements } from "./utils/getLayoutedElements.ts";

interface FlowData {
  nodes?: unknown[];
  edges?: unknown[];
}

interface FlowEvent {
  onNodeSelect?: (nodeId: string) => void;
}

const Flow = ({ data, event: _event }: { data: FlowData; event: FlowEvent }) => {
  const { nodes: initNodes = [], edges: initEdges = [] } = data;
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes as Node[]);
  const [edges, setEdges] = useEdgesState(initEdges as Edge[]);

  const onLayout = useCallback(
    (direction: string) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        direction,
      );
      console.log(layoutedNodes);
      setNodes([...layoutedNodes] as Node[]);
      setEdges([...layoutedEdges] as Edge[]);
    },
    [nodes, edges],
  );

  const nodesInitialized = useNodesInitialized();
  useEffect(() => {
    if (nodesInitialized) {
      onLayout("TB");
    }
  }, [nodesInitialized]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1">
        <ReactFlow
          nodes={ nodes }
          edges={ edges }
          nodeTypes={ flowReaderNodeTypes }
          onNodesChange={ onNodesChange }
          connectionLineType={ ConnectionLineType.SmoothStep }
          // Read-only switches
          nodesDraggable={ false }
          nodesConnectable={ false }
          deleteKeyCode={ null }
          edgesReconnectable={ false }
          // elementsSelectable={false}
          // nodesFocusable={true}
          edgesFocusable={ false }
          // selectNodesOnDrag={false}
          // connectOnClick={false}
          fitView
        >
          <Panel position="top-right">
            <button
              className="xy-theme__button"
              onClick={ () => onLayout("TB") }
            >
              vertical layout
            </button>
            <button
              className="xy-theme__button"
              onClick={ () => onLayout("LR") }
            >
              horizontal layout
            </button>
          </Panel>
          <Background />
        </ReactFlow>
        <ExecutionDetailsBar />
      </div>
    </div>

  );
};

interface FlowReaderProps {
  data: FlowData;
  event: FlowEvent;
}

export const FlowReader = (props: FlowReaderProps) => {
  return (
    <ReactFlowProvider>
      <Flow { ...props } />
    </ReactFlowProvider>
  );
};

export default FlowReader;
