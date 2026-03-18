import { Label } from "@shared/components/ui/label.tsx";

interface NodeData {
  data: Record<string, unknown>;
  id: string;
}

export const LogicReadNodeDetails = ({ data: nodeData }: { data: NodeData }) => {
  const data = nodeData.data;

  return (
    <>
      <h2 className="font-semibold mb-4">Condition: {data.label as string}</h2>
      <div className="mb-4">
        <Label className="capitalize mb-2">FIELD</Label>
        <p className="text-sm bg-gray-100 p-2">FIELD from MS</p>
      </div>
      <div className="mb-4">
        <Label className="capitalize mb-2">EVENT DATA</Label>
        <p className="text-sm bg-gray-100 p-2">{JSON.stringify(data)}</p>
      </div>
    </>
  );
};

export default LogicReadNodeDetails;
