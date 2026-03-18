import { type Edge, useEdges, useReactFlow } from "@xyflow/react";

import { Combobox } from "@shared/components/ui/combobox.tsx";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@shared/components/ui/input.tsx";
import { useQuery } from "@tanstack/react-query";
import { getEventSources, getMetadata } from "@domain/communication/flows/api/flows.api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/select";

interface BasicOutput {
  name?: string;
  description?: string;
}

interface NodeData {
  data: Record<string, unknown>;
  id: string;
}

interface InternalData {
  basicOutput?: BasicOutput;
  output?: {
    selectedEventSourceId?: string | number;
    selectedEventId?: string | number;
    eventId?: string | number;
  };
}

interface EventSource {
  eventSourceId: string;
  eventSourceName: string;
}

interface MetadataItem {
  eventId: string;
  eventName: string;
}

export const TriggerNodeDetails = ({ data: nodeData }: { data: NodeData }) => {
  const { updateNodeData } = useReactFlow();
  const edges: Edge[] = useEdges();
  const data = nodeData.data as InternalData;
  const selectedEventSourceId = data?.output?.selectedEventSourceId;

  const { data: eventSourcesData } = useQuery({
    queryKey: ["getEventSources"],
    queryFn: () => getEventSources(),
  });

  const { data: metaData } = useQuery({
    queryKey: [`metadata-${selectedEventSourceId}`, { selectedEventSourceId }],
    queryFn: () => getMetadata({ eventSourceId: selectedEventSourceId }),
    enabled: !!selectedEventSourceId,
  });

  const resetChildNodes = () => {
    const childIds = edges.filter(edge => edge.source === nodeData.id);

    while (childIds.length > 0) {
      const tempChild = [...childIds];
      for (let i = 0; i < tempChild.length; i++) {
        const curr = childIds.shift();
        if (!curr) continue;
        updateNodeData(curr.target, (prev) => ({ ...prev.data, output: {} }));
        const childEdges = edges.filter(edge => edge.source === curr.target);
        childIds.push(...childEdges);
      }
    }
  };

  const onEventSourceChange = (value: string) => {
    updateNodeData(nodeData.id, () => ({ output: { selectedEventId: null, selectedEventSourceId: value } }));
    resetChildNodes();
  };

  const onEventChange = (value: string) => {
    updateNodeData(nodeData.id, (prev) => {
      const output = { ...prev.data.output || { selectedEventId: value } };
      output.selectedEventId = value;
      return ({ output });
    });
    resetChildNodes();
  };

  return (
    <>
      <div className="flex flex-col gap-2 mb-4">
        <Label>NODE NAME</Label>
        <Input
          type="text"
          value={ data.basicOutput?.name }
          onChange={ (e) => updateNodeData(nodeData.id, () => ({ basicOutput: { ...data.basicOutput, name: e.target.value } })) }
        />
      </div>
      <div className="flex flex-col gap-2 mb-4">
        <Label>DESCRIPTION</Label>
        <Input
          type="text"
          value={ data.basicOutput?.description }
          onChange={ (e) => updateNodeData(nodeData.id, () => ({ basicOutput: { ...data.basicOutput, description: e.target.value } })) }
        />
      </div>
      <div className="flex flex-col gap-2 mb-4">
        <Label className="uppercase">Trigger Event Group</Label>
        { eventSourcesData && (
          <Select
            value={ String(data?.output?.selectedEventSourceId || "") }
            onValueChange={ onEventSourceChange }
          >
            <SelectTrigger className="w-full bg-white">
              <SelectValue placeholder="Select Event Source" />
            </SelectTrigger>
            <SelectContent className="w-auto min-w-[120px]">
              {eventSourcesData.map((item: EventSource) => (
                <SelectItem key={item.eventSourceId} value={ item.eventSourceId }>{ item.eventSourceName }</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) }
      </div>
      { metaData && (
        <div className="flex flex-col gap-2 mb-4">
          <Label className="uppercase">TRIGGER EVENT TYPE</Label>
          <Combobox
            value={ data?.output?.selectedEventId }
            onValueChange={ onEventChange }
            options={ metaData.map((item: MetadataItem) => ({ value: item.eventId, label: item.eventName })) }
            placeholder="Select"
          />
        </div>
      ) }
    </>
  );
};

export default TriggerNodeDetails;