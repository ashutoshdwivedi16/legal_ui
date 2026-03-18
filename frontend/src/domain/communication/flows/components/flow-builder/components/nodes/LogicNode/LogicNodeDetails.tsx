import { Separator } from "@shared/components/ui/separator.tsx";
import { Button } from "@shared/components/ui/button.tsx";
import { useReactFlow } from "@xyflow/react";

import { XIcon, PlusIcon } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { LogicNodeItem } from "./LogicNodeItem";
import { Label } from "@shared/components/ui/label.tsx";
import { Input } from "@shared/components/ui/input.tsx";
import { useQuery } from "@tanstack/react-query";
import { getEventProperties } from "@domain/communication/flows/api/flows.api";

interface BasicOutput {
  name?: string;
}

interface EventProperty {
  data_type: string;
  label: string;
  name: string;
}

interface NodeData {
  data: Record<string, unknown>;
  id: string;
}

interface InternalData {
  eventId?: string | number;
  basicOutput?: BasicOutput;
  output?: {
    rules?: unknown[];
  };
}

interface Attribute {
  type: string;
  label: string;
  name: string;
}

interface FormValues {
  rules: {
    attributeId?: string;
    conditionOp?: string;
    conditionValue?: string | boolean | null;
  }[];
}

export const LogicNodeDetails = ({ data: nodeData }: { data: NodeData }) => {
  const { data: rawData, id } = nodeData;
  const data = rawData as InternalData;
  const { updateNodeData } = useReactFlow();

  const eventId = data?.eventId;
  const { data: eventPropertiesData } = useQuery({
    queryKey: [`getEventProperties-${ eventId }`, { eventId }],
    queryFn: () => getEventProperties({ eventId }),
    enabled: !!eventId,
  });

  const properties = {
    eventId: eventId,
    eventProperties: eventPropertiesData?.eventProperties.map((property: EventProperty) => ({
      type: property.data_type,
      label: property.label,
      name: property.name,
    })),
  };

  const form = useForm<FormValues>({
    values: {
      rules: (data?.output?.rules || []) as FormValues['rules'],
    },
    mode: "onChange",
  });
  const { control } = form;

  const rules = useWatch({
    control,
    name: "rules",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "rules",
  });

  useEffect(() => {
    if (rules)
      updateNodeData(id, (prev) => ({ ...prev.data, output: { rules } }));
  }, [rules]);

  return (
    <>
      <div className="flex flex-col gap-2 mb-4">
        <Label>NODE NAME</Label>
        <Input
          type="text"
          value={ data.basicOutput?.name || '' }
          onChange={ (e) => updateNodeData(nodeData.id, () => ({ basicOutput: { ...data.basicOutput, name: e.target.value } })) }
        />
      </div>
      <Separator className="mb-4" />
      { properties?.eventProperties && (
        <>
          { fields.map((_field, index) => (

            <div className="mb-2" key={index}>
              <div className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={ () => remove(index) }
                  aria-label={ `Remove rule ${ index + 1 }` }
                >
                  <XIcon />
                </Button>
              </div>

              <LogicNodeItem
                attributes={ properties.eventProperties as Attribute[] }
                form={ form }
                index={ index }
              />
              <Separator />
            </div>

          )) }
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={ () => append({}) }
          >

              Add Condition
            <PlusIcon />
          </Button>
        </>
      ) }
    </>
  );
};

export default LogicNodeDetails;