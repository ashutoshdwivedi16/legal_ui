import { Label } from "@shared/components/ui/label.tsx";

interface NodeData {
  data: Record<string, unknown>;
  id: string;
}

export const ActionReadNodeDetails = ({ data: nodeData }: { data: NodeData }) => {
  const { data } = nodeData;

  return (
    <>
      <h2 className="font-semibold mb-4">Action: { data.label as string }</h2>
      <div className="mb-4">
        <Label className="capitalize mb-2">EMAIL TEMPLATE ID</Label>
        <p className="text-sm bg-gray-100 p-2">ID from MS</p>
      </div>
      <div className="mb-4">
        <Label className="capitalize mb-2">ACTION DATA</Label>
        <p className="text-sm bg-gray-100 p-2">{ JSON.stringify(data) }</p>
      </div>
    </>
  );
};

export default ActionReadNodeDetails;