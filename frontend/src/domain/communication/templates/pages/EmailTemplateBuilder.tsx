import { useState } from "react";
import { EmailFlowBuilder } from "../components/email-editor/App";
import { getTemplateList } from "../../templates/api/templates.api";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

export function EmailTemplateBuilder() {
 const { templateId } = useParams();
  const isNew = templateId === "new";

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [loadTemplateId, setLoadTemplateId] = useState<number | null>(null);

  // Only fetch templates list for new page
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ["getTemplates"],
    queryFn: () => getTemplateList({ size: 1000, sort: "templateName" }),
    enabled: isNew, // Only fetch when on new page
  });

  const templates = templatesData?.content || [];

  // Handle template selection from dropdown (just select, don't load)
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };

  // Load template when user clicks Load Template button
  const handleLoadTemplate = () => {
    if (selectedTemplateId && !isNaN(Number(selectedTemplateId))) {
      setLoadTemplateId(Number(selectedTemplateId));
    }
  };

  return (
    <div
      id="emailTemplateBuilder"
      className="h-full"
    >
      <EmailFlowBuilder 
        loadTemplateId={isNew ? loadTemplateId : undefined}
        // Props for template selection (only for new page)
        isNew={isNew}
        templates={isNew ? templates : []}
        selectedTemplateId={isNew ? selectedTemplateId : null}
        onTemplateSelect={isNew ? handleTemplateSelect : undefined}
        onLoadTemplate={isNew ? handleLoadTemplate : undefined}
        isLoadingTemplates={isNew ? isLoading : false}
      />
    </div>
  );
}

export default EmailTemplateBuilder;