import { useDraggable } from "@neodrag/react";
import { useReactFlow } from "@xyflow/react";
import type { XYPosition } from "@xyflow/react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@shared/lib/utils.ts";

import { ZapIcon, GitBranch, MailIcon, GripVertical } from "lucide-react";

import { flowBuilderNodeTypes, nodeTypesEnum } from "./nodes";

interface DraggableNodeProps {
  className?: string;
  children: React.ReactNode;
  nodeType: keyof typeof flowBuilderNodeTypes;
  onDrop: (nodeType: keyof typeof flowBuilderNodeTypes, position: XYPosition) => void;
}

function DraggableNode({ className, children, nodeType, onDrop }: DraggableNodeProps) {
  const draggableRef = useRef(null);
  const [position, setPosition] = useState<XYPosition>({ x: 0, y: 0 });

  useDraggable(draggableRef as any, {
    position: position,
    onDrag: ({ offsetX, offsetY }) => {
      // Calculate position relative to the viewport
      setPosition({
        x: offsetX,
        y: offsetY,
      });
    },
    onDragEnd: ({ event }) => {
      setPosition({ x: 0, y: 0 });
      onDrop(nodeType, {
        x: event.clientX,
        y: event.clientY,
      });
    },
  });

  return (
    <div
      className={ cn("dndnode", className) }
      ref={ draggableRef }
    >
      { children }
    </div>
  );
}

const getNodeData = (nodeType: keyof typeof flowBuilderNodeTypes) => {
  switch (nodeType) {
    case nodeTypesEnum.triggerNode:
      return {
        label: "Trigger",
        icon: ZapIcon,
      };
    case nodeTypesEnum.logicNode:
      return {
        label: "Logic",
        icon: GitBranch,
      };
    case nodeTypesEnum.actionNode:
      return {
        label: "Send Email",
        icon: MailIcon,
      };
    default:
      return {};
  }
};

export function SideBar({ latestNodeId }: { latestNodeId: number }) {
  const { setNodes, screenToFlowPosition } = useReactFlow();

  const handleNodeDrop = useCallback(
    (nodeType: keyof typeof flowBuilderNodeTypes, screenPosition: XYPosition) => {
      const flow = document.querySelector(".react-flow");
      const flowRect = flow?.getBoundingClientRect();
      const isInFlow =
        flowRect &&
        screenPosition.x >= flowRect.left &&
        screenPosition.x <= flowRect.right &&
        screenPosition.y >= flowRect.top &&
        screenPosition.y <= flowRect.bottom;

      // Create a new node and add it to the flow
      if (isInFlow) {
        const position = screenToFlowPosition(screenPosition);

        const newNode = {
          id: `${++latestNodeId}`,
          type: nodeType,
          position,
          data: getNodeData(nodeType),
        };

        setNodes((nds) => nds.concat(newNode));
      }
    },
    [setNodes, screenToFlowPosition],
  );

  return (
    <aside className="p-4 z-10">
      <div className="font-bold mb-2">
        Node Types
      </div>
      { Object.keys(flowBuilderNodeTypes).map((nodeType) => {
        const nodeData = getNodeData(nodeType as keyof typeof flowBuilderNodeTypes);
        const NodeIcon = nodeData.icon || null;
        return (
          <DraggableNode
            className="input min-w-[180px]"
            nodeType={ nodeType as keyof typeof flowBuilderNodeTypes }
            onDrop={ handleNodeDrop }
          >
            <div className="flex items-center border-2 border-dashed border-gray-300 p-2 rounded-md cursor-pointer hover:bg-red-100 hover:border-red-800 mb-3">
              {NodeIcon && (
                <NodeIcon
                  className="inline mr-2 p-2 bg-gray-200 rounded-sm"
                  width={ 35 }
                  height={ 35 }
                />
              )}
              <span>
                { nodeData.label}
                <GripVertical
                  width={ 14 }
                  height={ 14 }
                />
              </span>
            </div>
          </DraggableNode>
        );
      }) }
      {/*<DraggableNode className="input" nodeType="input" onDrop={handleNodeDrop}>*/ }
      {/*  Input Node*/ }
      {/*</DraggableNode>*/ }
      {/*<DraggableNode className="default" nodeType="default" onDrop={handleNodeDrop}>*/ }
      {/*  Default Node*/ }
      {/*</DraggableNode>*/ }
      {/*<DraggableNode className="output" nodeType="output" onDrop={handleNodeDrop}>*/ }
      {/*  Output Node*/ }
      {/*</DraggableNode>*/ }
    </aside>
  );
}
