import { getTransactionDetails } from "../../transactions/api/transactions.api";
import { FlowReader } from "../components/flow-builder/FlowReader.tsx";
import { Spinner } from "@shared/components/ui/spinner.tsx";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";

export function EmailFlowBuilder() {
  const { transactionId } = useParams();
  const navigate = useNavigate();

  const { status, data, error } = useQuery({
    queryKey: [`transactionDetails-${ transactionId }`, { transactionId }],
    queryFn: () => getTransactionDetails({ flowId: transactionId! }),
  });

  if ((error as AxiosError)?.status === 400) {
    navigate("/404");
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
        <FlowReader
          data={ {
            nodes: data.latestVersion.definition.node,
            edges: data?.latestVersion.definition.edge,
          } }
          event={ {} }
        />
      )}
    </div>
  );
}

export default EmailFlowBuilder;