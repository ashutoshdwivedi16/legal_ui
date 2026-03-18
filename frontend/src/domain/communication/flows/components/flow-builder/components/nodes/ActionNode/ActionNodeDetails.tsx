import { Input } from "@shared/components/ui/input.tsx";
import { Label } from "@shared/components/ui/label";
import { useReactFlow } from "@xyflow/react";
import "./style.css";
import { Combobox } from "@shared/components/ui/combobox.tsx";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getTemplateDetails, getTemplateList, previewTemplate } from "@domain/communication/templates/api/templates.api";
import { useEffect, useState } from "react";
import { Spinner } from "@shared/components/ui/spinner.tsx";
import { Separator } from "@shared/components/ui/separator.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/components/ui/select";
import { Button } from "@shared/components/ui/button.tsx";
import { EyeIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import type { AxiosError } from "axios";
import { getEventProperties } from "@domain/communication/flows/api/flows.api";
import { toast } from "sonner";

interface MappingItem {
  value?: string | null;
  templateVariable?: string;
  isCustom?: boolean;
}

interface BasicOutput {
  name?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
}

interface NodeData {
  data: Record<string, unknown>;
  id: string;
}

interface InternalData {
  eventId?: string | number;
  basicOutput?: BasicOutput;
  output?: {
    selectedOption?: string | number;
    selectedTemplateId?: string | number;
    mappings?: Record<string, string>;
    mapping?: MappingItem[];
  };
}

interface EventProperty {
  label: string;
  name: string;
}

export const ActionNodeDetails = ({ data: nodeData }: { data: NodeData }) => {
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
    eventId,
    eventProperties: (eventPropertiesData?.eventProperties || []).map((property: EventProperty) => ({
      label: property.label,
      value: property.name,
    })),
  };

  const { data: templatesData } = useQuery({
    queryKey: ["getTemplates"],
    queryFn: () => getTemplateList({ size: 1000, sort: "templateName" }),
  });

  interface TemplateOption {
    emailTemplateId: string | number;
    templateName: string;
  }

  const templates = (templatesData?.content || []).map((option: TemplateOption) => ({
    value: option.emailTemplateId,
    label: option.templateName,
  }));

  const currentOutput = data?.output;

  const onChange = (selectedTemplateId: string | number) => {
    updateNodeData(id, () => ({ output: { selectedTemplateId } }));
  };

  const updateOutput = (index: number, value: Partial<MappingItem>) => {
    updateNodeData(id, () => {
      const mapping = currentOutput?.mapping || [];
      const curr = { ...mapping[index], ...value };
      return ({ output: { ...currentOutput, mapping: [...mapping.slice(0, index), curr, ...mapping.slice(index + 1)] } });
    });
  };
  const templateId = currentOutput?.selectedTemplateId || null;

  const { status, data: templateData, error } = useQuery({
    queryKey: [`getTemplateDetails-${templateId}`, { templateId }],
    queryFn: () => getTemplateDetails({ templateId: templateId as string | number }),
    enabled: !!templateId,
  });

  useEffect(() => {
    if (templateData && templateData?.templateVariables?.length > 0) {
      const templateVariableObj = currentOutput?.mapping?.reduce((total: Record<string, MappingItem>, item: MappingItem) => {
        if (!item.templateVariable) return total;
        return ({ ...total, [item.templateVariable]: item });
      }, {});
      const mapping = templateData.templateVariables.map((variable: { name: string }) => ({
        value: templateVariableObj?.[variable.name]?.value || null,
        templateVariable: variable.name,
        isCustom: templateVariableObj?.[variable.name]?.isCustom || false,
      }));
      updateNodeData(id, () => ({
        output: { ...currentOutput, mapping },
      }));
    }
  }, [templateData]);

  const [previewHtml, setPreviewHtml] = useState("");
  const previewTemplateMutation = useMutation({
    mutationFn: previewTemplate,
    onSuccess: (responseData: { previewHtml: string }) => {
      toast.success("Your request has been completed successfully.");
      setPreviewHtml(responseData.previewHtml);
    },
    onError: () => {
      toast.error("Something went wrong on our end. Please try again later.");
    },
  });

  return (
    <>
      <div className="flex flex-col gap-2 mb-4">
        <Label>NODE NAME</Label>
        <Input type="text" value={ data.basicOutput?.name || '' } onChange={ (e) => updateNodeData(nodeData.id, () => ({ basicOutput: { ...data.basicOutput, name: e.target.value } })) } />
      </div>
      {/*  <div className="flex flex-col gap-2 mb-4">
        <Label>FROM NAME</Label>
        <Input type="text" value={ data.basicOutput?.fromName } onChange={ (e) => updateNodeData(nodeData.id, () => ({ basicOutput: { ...data.basicOutput, fromName: e.target.value } })) } />
      </div>
      <div className="flex flex-col gap-2 mb-4">
        <Label>FROM EMAIL</Label>
        <Input type="text" value={ data.basicOutput?.fromEmail } onChange={ (e) => updateNodeData(nodeData.id, () => ({ basicOutput: { ...data.basicOutput, fromEmail: e.target.value } })) } />
      </div>
      <div className="flex flex-col gap-2 mb-4">
        <Label>SUBJECT LINE</Label>
        <Input type="text" value={ data.basicOutput?.subject } onChange={ (e) => updateNodeData(nodeData.id, () => ({ basicOutput: { ...data.basicOutput, subject: e.target.value } })) } />
      </div>*/}
      <div className="flex flex-col gap-2 mb-4">
        <Label>CC</Label>
        <Input type="text" value={ data.basicOutput?.cc || '' } onChange={ (e) => updateNodeData(nodeData.id, () => ({ basicOutput: { ...data.basicOutput, cc: e.target.value } })) } />
      </div>
      <div className="flex flex-col gap-2 mb-4">
        <Label>BCC</Label>
        <Input type="text" value={ data.basicOutput?.bcc || '' } onChange={ (e) => updateNodeData(nodeData.id, () => ({ basicOutput: { ...data.basicOutput, bcc: e.target.value } })) } />
      </div>
      <div className="flex flex-col gap-2 mb-4">
        <Label>REPLY TO</Label>
        <Input type="text" value={ data.basicOutput?.replyTo || '' } onChange={ (e) => updateNodeData(nodeData.id, () => ({ basicOutput: { ...data.basicOutput, replyTo: e.target.value } })) } />
      </div>
      <Separator className="mb-4" />
      <>
        <div className="flex flex-col gap-2 mb-4">
          <Label>EMAIL TEMPLATE</Label>
          <Combobox
            value={ currentOutput?.selectedTemplateId || null }
            onValueChange={ onChange }
            options={ templates }
            placeholder="Select"
          />
        </div>
        <Label className="mb-2">VARIABLE MAPPING</Label>
        <p className="mb-2 text-sm text-muted-foreground">Map template variables to event properties from the trigger</p>
        {templateId && (
          <>
            {/* Render template variables based on selected template */}
            { status === "pending" && (
              <div className="flex justify-center items-center p-10 w-full">
                <Spinner className="text-destructive size-10" />
              </div>
            ) }
            { status === "error" && <span>Error: { error.message }</span> }
            { status === "success" && (
              <div className="mb-4">
                { templateId && templateData?.templateVariables?.map((variable: { name: string }, idx: number) => (
                  <div
                    className="bg-gray-100 p-4 mb-4"
                    key={ `template-var-${templateData.emailTemplateId}-${variable.name}-${idx}` }
                  >
                    <div className="flex flex-col gap-2 mb-4">
                      <Label>Template Variable</Label>
                      <Input
                        className="bg-white text-red-700"
                        type="text"
                        value={ `{{${variable.name}}}` }
                        readOnly
                      />
                    </div>
                    <div className="flex flex-col gap-2 mb-4">
                      <Label>Mapping Selector</Label>
                      <Select
                        value={ currentOutput?.mapping?.[idx]?.isCustom ? "true" : "false" }
                        onValueChange={ (val) => updateOutput(idx, { isCustom: val === "true", value: null }) }
                      >
                        <SelectTrigger className="w-full bg-white">
                          <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent className="w-auto min-w-[120px]">
                          <SelectItem value="false">Event Data Mapping</SelectItem>
                          <SelectItem value="true">Static Data Mapping</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2 mb-4">
                      {currentOutput?.mapping?.[idx]?.isCustom ? (
                        <>
                          <Label>Value</Label>
                          <Input
                            className="bg-white"
                            type="text"
                            value={ currentOutput?.mapping?.[idx]?.value ?? '' }
                            onChange={ (e) => updateOutput(idx, { value: e.target.value, isCustom: true }) }
                          />
                        </>
                      ) : (
                        <>
                          <Label>Event Data Mapping</Label>
                          <Combobox
                            value={ currentOutput?.mapping?.[idx]?.value ?? '' }
                            onValueChange={ (val) => updateOutput(idx, { value: val, isCustom: false }) }
                            options={ properties.eventProperties }
                            placeholder="Select"
                          />
                        </>
                      )}
                    </div>
                  </div>
                )) }
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      className="w-full"
                      variant="destructive"
                      disabled={!properties.eventId}
                      onClick={ () => previewTemplateMutation.mutate({
                        templateId: templateId as string | number,
                        eventId: properties.eventId as string | number,
                        mappings: currentOutput?.mapping,
                      }) }
                    >
                      <EyeIcon />
                      Show Preview
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-6xl max-w-full! max-h-full overflow-auto">
                    <DialogHeader>
                      <DialogTitle>Email preview</DialogTitle>
                      <DialogDescription>
                        Email preview
                      </DialogDescription>
                    </DialogHeader>
                    <div className="">
                      {previewTemplateMutation.isPending && (
                        <div className="flex justify-center items-center w-full">
                          <Spinner className="text-destructive size-10" />
                        </div>
                      )}
                      {previewTemplateMutation.isSuccess &&
                      <div dangerouslySetInnerHTML={ { __html: previewHtml } } />
                      }
                      {previewTemplateMutation.isError &&
                      <p>{JSON.stringify((previewTemplateMutation?.error as AxiosError)?.response?.data)}</p>
                      }
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </>
        )}
      </>
    </>
  );
};

export default ActionNodeDetails;