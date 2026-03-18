import { Label } from "@shared/components/ui/label.tsx";

interface NodeData {
  data: Record<string, unknown>;
  id: string;
}

export const TriggerReadNodeDetails = ({ data: nodeData }: { data: NodeData }) => {
  const data = nodeData.data;
  const output = data.output as { selectedEventId?: string } | undefined;

  return (
    <>
      <h2 className="font-semibold mb-4">Trigger: { data.label as string }</h2>
      <div className="mb-4">
        <Label className="capitalize mb-2">EVENT ID</Label>
        <p className="text-sm bg-gray-100 p-2">{ output?.selectedEventId }</p>
      </div>
      <div className="mb-4">
        <Label className="capitalize mb-2">EVENT DATA</Label>
        <p className="text-sm bg-gray-100 p-2">{ JSON.stringify(data) }</p>
      </div>
    </>
  );
};

export default TriggerReadNodeDetails;