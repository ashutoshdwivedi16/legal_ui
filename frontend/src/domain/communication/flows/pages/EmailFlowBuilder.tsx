import { createFlow, enableFlow, getFlowDetails, updateFlow } from "../../flows/api/flows.api";
import { FlowBuilder } from "../components/flow-builder/FlowBuilder.tsx";
import { Spinner } from "@shared/components/ui/spinner.tsx";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";
import { toast } from "sonner";

export function EmailFlowBuilder() {
  const { flowId } = useParams();
  const isNew = flowId === "new";
  const navigate = useNavigate();

  const { status, data, error } = useQuery({
    queryKey: [`flow-${ flowId }`, { flowId }],
    queryFn: () => getFlowDetails({ flowId: flowId! }),
    enabled: !isNew,
  });

  if ((error as AxiosError)?.status === 400) {
    navigate("/404");
  }

  const enableFlowMutation = useMutation({
    mutationFn: enableFlow,
    onSuccess: () => {
      toast.success("Flow paused/in-activated successfully");
    },
    onError: (error: AxiosError) => {
      const errorResponse = (error.response?.data as { errors?: { code?: string; message?: string }[] })?.errors;
      const errorList = <ul>{errorResponse?.map((item, index) => <li key={ `${item?.code || ""}-${index}` }>{ item?.message }</li>)}</ul>;
      toast.error((errorResponse && errorList) || "Failed to in-active flow. Please try again");
    },
  });

  const createFlowMutation = useMutation({
    mutationFn: createFlow,
    onSuccess: (responseData) => {
      toast.success("Flow saved successfully");
      navigate(`../${ responseData.flowId }`, { relative: "path" });
    },
    onError: () => {
      toast.error("Failed to save flow. Please try again");
    },
  });

  const updateFlowMutation = useMutation({
    mutationFn: updateFlow,
    onSuccess: () => {
      toast.success("Flow updated and published successfully");
    },
    onError: () => {
      toast.error("Failed to save flow. Please try again");
    },
  });

  const onEnableChanged = (value: boolean) => {
    if (!enableFlowMutation.isPending)
      enableFlowMutation.mutate({ flowId: flowId!, value });
  };

  const onSave = ({ flowName, description = '', nodes, edges }: { flowName: string; description?: string; nodes: unknown[]; edges: unknown[] }) => {
    if (!isNew && !updateFlowMutation.isPending)
      updateFlowMutation.mutate({ flowId: flowId!, flowName, description, nodes, edges });
    if (isNew && !createFlowMutation.isPending)
      createFlowMutation.mutate({ flowName, description, nodes, edges });
  };

  const onExit = () => {
    navigate("..", { relative: "path" });
  };

  if (isNew) {
    return (
      <FlowBuilder
        data={ {} }
        event={ {
          onEnableChanged,
          onSave,
          onExit,
        } }
      />
    );
  }

  return (
    <div id="react-flow">
      { status === "pending" && (
        <div className="flex justify-center items-center h-full w-full">
          <Spinner className="text-destructive size-10" />
        </div>
      ) }
      { status === "error" && <span>Error: { error.message }</span> }
      { status === "success" && (
        <FlowBuilder
          data={ {
            nodes: data.latestVersion.definition.node,
            edges: data?.latestVersion.definition.edge,
            name: data.name,
            status: data?.status,
            latestNodeId: data?.nodeLastNumber,
          } }
          event={ {
            onEnableChanged,
            onSave,
            onExit,
          } }
        />
      )}
    </div>
  );
}

export default EmailFlowBuilder;