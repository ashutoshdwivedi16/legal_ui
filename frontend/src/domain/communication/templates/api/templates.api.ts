import apiClient from "@shared/lib/axios";

export type TemplateStatus = "PUBLISHED" | "DRAFT";

export type TemplateVariable = {
  name: string;
  label: string;
  data_type: string;
};

export type Template = {
  emailTemplateId: number;
  templateName: string;
  description: string;
  status: TemplateStatus;
  subjectLine: string;
  templateBodyMjml: string;
  templateVariables: TemplateVariable[];
  currentVersion: number;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
};

export type GetTemplateListResponse = {
  content: Template[];
  totalPages: number;
  totalElements: number;
  last: boolean;
  size: number;
  number: number;
  sort: any[];
  numberOfElements: number;
  first: boolean;
  empty: boolean;
};

/*const mockTemplateData: GetTemplateListResponse = {
  "content": [
    {
      "emailTemplateId": 1,
      "templateName": "Welcome Email",
      "description": "Template for user welcome email.",
      "status": "DRAFT",
      "subjectLine": "Welcome to Our Service!",
      "templateBodyMjml": "<mjml>...</mjml>",
      "templateVariables": [],
      "currentVersion": 1,
      "createdBy": 1,
      "updatedBy": 1,
      "createdAt": "2026-01-09T21:02:09.023406",
      "updatedAt": "2026-01-09T21:02:09.023441"
    },
    {
      "emailTemplateId": 2,
      "templateName": "Welcome Email",
      "description": "Template for user welcome email.",
      "status": "DRAFT",
      "subjectLine": "Welcome to Our Service!",
      "templateBodyMjml": "<mjml>...</mjml>",
      "templateVariables": [],
      "currentVersion": 1,
      "createdBy": 1,
      "updatedBy": 1,
      "createdAt": "2026-01-09T21:04:10.482995",
      "updatedAt": "2026-01-09T21:04:10.483028"
    },
    {
      "emailTemplateId": 3,
      "templateName": "HKM-TEST-1",
      "description": "string",
      "status": "DRAFT",
      "subjectLine": "string",
      "templateBodyMjml": "<mjml>\n  <mj-head>\n    <mj-preview>Your order {{order.id}} is complete</mj-preview>\n    <mj-attributes>\n      <mj-text font-family=\"Arial, sans-serif\" font-size=\"14px\" color=\"#333333\" line-height=\"1.6\" />\n      <mj-section background-color=\"#ffffff\" />\n    </mj-attributes>\n  </mj-head>\n\n  <mj-body background-color=\"#f4f6f8\" width=\"600px\">\n\n    <mj-section padding=\"20px\">\n      <mj-column>\n        <mj-text font-size=\"22px\" font-weight=\"bold\" align=\"center\">✅ Order Completed</mj-text>\n        <mj-text align=\"center\">Thank you for your purchase, {{customer.username}}!</mj-text>\n      </mj-column>\n    </mj-section>\n\n    <mj-section padding=\"20px\" border-radius=\"6px\">\n      <mj-column>\n        <mj-text font-weight=\"bold\">Order Information</mj-text>\n        <mj-text>\n          <strong>Order ID:</strong> {{order.id}}<br/>\n          <strong>Order Date:</strong> {{order.date}}<br/>\n          <strong>Payment Method:</strong> {{order.paymentMethod}}\n        </mj-text>\n      </mj-column>\n    </mj-section>\n\n    <mj-section padding=\"20px\" border-radius=\"6px\">\n      <mj-column>\n        <mj-text font-weight=\"bold\">Items Ordered</mj-text>\n\n        {{#each items}}\n        <mj-text>\n          {{name}}<br/>\n          Quantity: {{quantity}}<br/>\n          Price: {{price}}\n        </mj-text>\n        <mj-divider border-color=\"#e0e0e0\" />\n        {{/each}}\n\n        <mj-text font-weight=\"bold\" align=\"right\">Total: {{order.total}}</mj-text>\n      </mj-column>\n    </mj-section>\n\n    <mj-section padding=\"20px\" border-radius=\"6px\">\n      <mj-column>\n        <mj-text font-weight=\"bold\">Shipping Information</mj-text>\n        <mj-text>\n          {{shipping.address}}<br/>\n          {{shipping.city}}, {{shipping.postalCode}}<br/>\n          {{shipping.country}}<br/><br/>\n          <strong>Courier:</strong> {{shipping.courier}}<br/>\n          <strong>Tracking Number:</strong> {{shipping.trackingNumber}}\n        </mj-text>\n      </mj-column>\n    </mj-section>\n\n    <mj-section padding=\"20px\" border-radius=\"6px\">\n      <mj-column>\n        <mj-text font-weight=\"bold\">Customer Information</mj-text>\n        <mj-text>\n          {{customer.username}}<br/>\n          {{customer.email}}<br/>\n          {{customer.phoneNo}}\n        </mj-text>\n      </mj-column>\n    </mj-section>\n\n    <mj-section padding=\"20px\">\n      <mj-column>\n        <mj-text align=\"center\" font-size=\"12px\" color=\"#777777\">\n          If you have any questions, just reply to this email.<br/>\n          © 2025 Your Company Name\n        </mj-text>\n      </mj-column>\n    </mj-section>\n\n  </mj-body>\n</mjml>",
      "templateVariables": [
        {
          "name": "order.id",
          "label": "Order -> Id",
          "data_type": "string"
        },
        {
          "name": "customer.username",
          "label": "Customer -> Username",
          "data_type": "string"
        },
        {
          "name": "order.date",
          "label": "Order -> Date",
          "data_type": "string"
        },
        {
          "name": "order.paymentMethod",
          "label": "Order -> PaymentMethod",
          "data_type": "string"
        },
        {
          "name": "items",
          "label": "Items",
          "data_type": "list"
        },
        {
          "name": "items.name",
          "label": "Items -> Name",
          "data_type": "string"
        },
        {
          "name": "items.quantity",
          "label": "Items -> Quantity",
          "data_type": "string"
        },
        {
          "name": "items.price",
          "label": "Items -> Price",
          "data_type": "string"
        },
        {
          "name": "order.total",
          "label": "Order -> Total",
          "data_type": "string"
        },
        {
          "name": "shipping.address",
          "label": "Shipping -> Address",
          "data_type": "string"
        },
        {
          "name": "shipping.city",
          "label": "Shipping -> City",
          "data_type": "string"
        },
        {
          "name": "shipping.postalCode",
          "label": "Shipping -> PostalCode",
          "data_type": "string"
        },
        {
          "name": "shipping.country",
          "label": "Shipping -> Country",
          "data_type": "string"
        },
        {
          "name": "shipping.courier",
          "label": "Shipping -> Courier",
          "data_type": "string"
        },
        {
          "name": "shipping.trackingNumber",
          "label": "Shipping -> TrackingNumber",
          "data_type": "string"
        },
        {
          "name": "customer.email",
          "label": "Customer -> Email",
          "data_type": "string"
        },
        {
          "name": "customer.phoneNo",
          "label": "Customer -> PhoneNo",
          "data_type": "string"
        }
      ],
      "currentVersion": 2,
      "createdBy": 123,
      "updatedBy": 1,
      "createdAt": "2026-01-09T21:07:22.138608",
      "updatedAt": "2026-01-09T21:10:42.417223"
    },
    {
      "emailTemplateId": 4,
      "templateName": "string",
      "description": "string",
      "status": "DRAFT",
      "subjectLine": "string",
      "templateBodyMjml": "string",
      "templateVariables": [],
      "currentVersion": 1,
      "createdBy": 1,
      "updatedBy": 1,
      "createdAt": "2026-01-12T13:11:43.533501",
      "updatedAt": "2026-01-12T13:11:43.533572"
    }
  ],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 20,
    "sort": [],
    "offset": 0,
    "paged": true,
    "unpaged": false
  },
  "totalPages": 1,
  "totalElements": 4,
  "last": true,
  "size": 20,
  "number": 0,
  "sort": [],
  "numberOfElements": 4,
  "first": true,
  "empty": false
};*/

export const getTemplateList = async ({ query = "", status = "", sort = "", page = 1, size = 20 }): Promise<GetTemplateListResponse> => {
  console.log("debug api request getTemplateList", query, status, sort);
  const response = await apiClient.get(`/communication/templates?size=${size}&page=${page - 1}&sort=${sort}&status=${status != "all" ? status : "" }&q=${query}`);
  return response.data;
};

export const getTemplateDetails = async ({ templateId }: { templateId: string | number }): Promise<Template> => {
  console.log("debug api request getTemplateDetails", templateId);
  const response = await apiClient.get(`/communication/templates/${templateId}`);
  return response.data;
};

export const createTemplate = async ({ payload }: { payload: unknown }): Promise<Template> => {
  console.log("debug api request createTemplate", payload);
  const response = await apiClient.post<Template>(
    "/communication/templates",
    payload,
  );
  return response.data;
};

export const updateTemplateDetails = async ({ templateId, payload }: { templateId: string | number; payload: unknown }) : Promise<Template> => {
  console.log("debug api request updateTemplateDetails", templateId, payload);
  const response = await apiClient.put<Template>(
    `/communication/templates/${templateId}`,
    payload,
  );
  return response.data;
};

export const removeTemplate = async (templateId: string | number): Promise<Template> => {
  console.log("api request removeTemplate", templateId);
  const response = await apiClient.delete(`/communication/templates/${templateId}`);
  return response.data;
};

export type previewTemplateResponse = {
  templateId: number,
  eventId: number,
  previewHtml: string,
};

export const previewTemplate = async ({ templateId, eventId, mappings }: { templateId: string | number; eventId: string | number; mappings: unknown }): Promise<previewTemplateResponse> => {
  console.log("api request previewTemplate", templateId);
  const response = await apiClient.post(`/communication/templates/${templateId}/preview`, {
    eventId,
    mappings,
  });
  return response.data;
};