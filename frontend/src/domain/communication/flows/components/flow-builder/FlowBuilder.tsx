import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@shared/components/ui/button.tsx";
import { InputGroup, InputGroupAddon } from "@shared/components/ui/input-group.tsx";
import { Input } from "@shared/components/ui/input.tsx";
import { Label } from "@shared/components/ui/label.tsx";
import { Separator } from "@shared/components/ui/separator.tsx";
import { Switch } from "@shared/components/ui/switch.tsx";
import { SquarePenIcon } from "lucide-react";
import { useCallback, useState } from "react";
import {
  Background,
  ReactFlow,
  addEdge,
  ConnectionLineType,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
} from "@xyflow/react";
import type { ReactFlowInstance, Connection } from "@xyflow/react";
import { resolveCollisions } from "./utils/resolveCollisions.ts";
import "@xyflow/react/dist/style.css";
import "./App.css";

import { SideBar } from "./components/SideBar.tsx";
import { PropertyBar } from "./components/PropertyBar.tsx";

import { flowBuilderNodeTypes } from "./components/nodes";
import { Field, FieldError } from "@shared/components/ui/field.tsx";
import { getLayoutedElements } from "./utils/getLayoutedElements.ts";
import { edgeParams } from "./config.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@shared/components/ui/alert-dialog.tsx";
import { buttonVariants } from "@/shared/components/ui/button";

const flowKey = "example-flow";

interface FlowData {
  nodes?: unknown[];
  edges?: unknown[];
  name?: string;
  status?: string;
  latestNodeId?: number;
}

interface FlowEvent {
  onEnableChanged: (value: boolean) => void;
  onSave: (data: { flowName: string; description?: string; nodes: unknown[]; edges: unknown[] }) => void;
  onExit: () => void;
}

interface FlowProps {
  data: FlowData;
  event: FlowEvent;
}

const Flow = ({ data, event }: FlowProps) => {
  const { nodes: initNodes = [], edges: initEdges = [], name: initFlowName = "", status, latestNodeId = 0 } = data;
  const { onEnableChanged, onSave, onExit } = event;
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes as never[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges as never[]);

  const onNodeDragStop = useCallback(() => {
    setNodes((nds) => resolveCollisions(nds, {
      maxIterations: Infinity,
      overlapThreshold: 0.5,
      margin: 15,
    }) as never[]);
  }, [setNodes]);
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((oldEdges) => addEdge({ ...connection, ...edgeParams }, oldEdges) as never[]);
    },
    [setEdges],
  );
  const onLayout = useCallback(
    (direction: string) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        direction,
      );

      setNodes([...layoutedNodes] as never[]);
      setEdges([...layoutedEdges] as never[]);
    },
    [nodes, edges, setNodes, setEdges],
  );

  const [rfInstance, setRfInstance] = useState<ReactFlowInstance>();
  const { setViewport } = useReactFlow();

  const formSchema = z.object({
    flowName: z.string().min(1, "Required"),
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      flowName: initFlowName,
      nodes,
      edges,
    },
  });

  const onSaveHandler = useCallback(() => {
    if (rfInstance) {
      const flow = rfInstance.toObject();
      console.log("save clicked", flow);
      form.setValue("nodes", flow.nodes);
      form.setValue("edges", flow.edges);

      form.handleSubmit(
        (formData) => {
          console.log("form", formData);
          onSave({ ...flow, flowName: formData.flowName });
        },
        (error) => console.log("error", error),
      )();

      localStorage.setItem(flowKey, JSON.stringify(flow));
    }
  }, [rfInstance, form, onSave]);

  const restoreFlow = useCallback(async () => {
    const raw = localStorage.getItem(flowKey);
    const flow = raw && JSON.parse(raw);

    if (flow) {
      const { x = 0, y = 0, zoom = 1 } = flow.viewport;
      setNodes(flow.nodes || []);
      setEdges(flow.edges || []);
      setViewport({ x, y, zoom });
    }
  }, [setNodes, setEdges, setViewport]);

  void restoreFlow;

  return (
    <div className="flex h-full flex-col">
      <div className="flex content-center justify-between p-4">
        <div>
          <Controller
            name="flowName"
            control={ form.control }
            render={ ({ field, fieldState }) => (
              <Field
                data-invalid={ fieldState.invalid }
                orientation="horizontal"
              >
                <InputGroup className="border-none">
                  <Input
                    { ...field }
                    type="text"
                    className="font-bold border-0 shadow-none border-b-2 rounded-none border-b-destructive"
                    defaultValue={ initFlowName }
                    // onChange={ (e) => setFlowName(e.target.value) }
                    required
                    name="flowName"
                  />
                  <InputGroupAddon align="inline-end">
                    <SquarePenIcon className="text-destructive" />
                  </InputGroupAddon>
                </InputGroup>
                { fieldState.invalid && (
                  <FieldError errors={ [fieldState.error] } />
                ) }
              </Field>
            ) }
          />
        </div>
        {/*<h2 className="font-bold border-b-2 border-b-red-800">{ flowName }</h2>*/ }
        <div className="flex space-x-4">
          <div className="flex items-center space-x-2">
            <p className="text-sm">Status: </p>
            <Label className="capitalize">{ status }</Label>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <span className="leading-[0]">
                  <Switch
                    className="bg-gray-200 data-[state=checked]:bg-destructive cursor-pointer"
                    checked={ status === "ACTIVE" }
                  />
                </span>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  {/*<AlertDialogDescription>*/}
                  {/*  Active Flow*/}
                  {/*</AlertDialogDescription>*/}
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className={ buttonVariants({ variant: "destructive" }) }
                    onClick={ () => onEnableChanged(status !== "ACTIVE") }
                  >
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <Button
            variant="destructive"
            onClick={ () => onSaveHandler() }
          >
            Save
          </Button>
          {/*<Button*/}
          {/*  variant="destructive"*/}
          {/*  onClick={ () => onSaveHandler(true) }*/}
          {/*>*/}
          {/*  Publish*/}
          {/*</Button>*/}
          {/*<Button*/}
          {/*  variant="outline"*/}
          {/*  onClick={ onRestore }*/}
          {/*>*/}
          {/*  restore*/}
          {/*</Button>*/}
          <Button
            variant="outline"
            onClick={ onExit }
          >
            Cancel
          </Button>
        </div>
      </div>
      <Separator />
      <div className="flex flex-1">
        <SideBar { ... { latestNodeId } } />
        <ReactFlow
          nodes={ nodes }
          edges={ edges }
          nodeTypes={ flowBuilderNodeTypes }
          onNodesChange={ onNodesChange }
          onEdgesChange={ onEdgesChange }
          onNodeDragStop={ onNodeDragStop }
          selectNodesOnDrag={ false }
          onConnect={ onConnect }
          onInit={ setRfInstance as any }
          connectionLineType={ ConnectionLineType.SmoothStep }
          fitView
        >
          <MiniMap pannable zoomable />
          <Controls />
          <Panel position="top-right" className="flex flex-col gap-4">
            <Button
              className="xy-theme__button"
              onClick={ () => onLayout("TB") }
            >
              vertical layout
            </Button>
            <button
              className="xy-theme__button"
              onClick={ () => onLayout("LR") }
            >
              horizontal layout
            </button>
            <button
              className="xy-theme__button"
              onClick={ () => console.log("nodes: ", nodes, "\nedges: ", edges) }
            >console result
            </button>
          </Panel>
          <Background />
        </ReactFlow>
        <PropertyBar />
      </div>
    </div>

  );
};

export const FlowBuilder = (props: FlowProps) => {
  return (
    <ReactFlowProvider>
      <Flow { ...props } />
    </ReactFlowProvider>
  );
};

export default FlowBuilder;
