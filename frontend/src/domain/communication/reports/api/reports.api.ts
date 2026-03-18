import apiClient from "@shared/lib/axios";

export type GetReportResponse = {
  date: string;
  stats: {
    metrics: unknown
  }[];
}[];

interface DateRange {
  from: Date;
  to: Date;
}

export const getReport = async ({ range }: { range: DateRange }): Promise<GetReportResponse> => {
  console.log("api request getReport", range);
  const response = await apiClient.get(`/communication/api/email/stats?startDate=${ range.from.toISOString().split("T")[0]}&endDate=${ range.to.toISOString().split("T")[0] }`);
  return response.data;
};
