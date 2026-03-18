import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Textarea } from "@shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@shared/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Spinner } from "@shared/components/ui/spinner";
import { Badge } from "@shared/components/ui/badge";
import { createSampleItem, updateSampleItem, getSampleItem } from "../api/sample.api";
import { usePermissionStore } from "@core/auth/stores/permissionStore";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "PENDING", "ARCHIVED"]),
});

type FormValues = z.infer<typeof formSchema>;

export const SampleItemForm = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mode = searchParams.get("mode") === "view" ? "view" : id ? "edit" : "create";
  const isViewMode = mode === "view";
  const isEditMode = mode === "edit";

  const { hasPermission } = usePermissionStore();
  const canCreate = hasPermission('sample:create');
  const canUpdate = hasPermission('sample:update');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "ACTIVE",
    },
  });

  const { data: existingItem, isLoading: isLoadingItem } = useQuery({
    queryKey: ["sampleItem", id],
    queryFn: () => getSampleItem(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (existingItem?.data) {
      form.reset({
        name: existingItem.data.name,
        description: existingItem.data.description,
        status: existingItem.data.status,
      });
    }
  }, [existingItem, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (isEditMode) {
        return updateSampleItem({ id: id!, data: values });
      }
      return createSampleItem(values);
    },
    onSuccess: () => {
      toast.success(isEditMode ? "Item updated successfully" : "Item created successfully");
      queryClient.invalidateQueries({ queryKey: ["sampleItems"] });
      navigate("/sample/sub-menu/items");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save item: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  const handleEditClick = () => {
    navigate(`/sample/sub-menu/items/${id}`);
  };

  if ((isEditMode || isViewMode) && isLoadingItem) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner className="size-10" />
      </div>
    );
  }

  const getTitle = () => {
    if (isViewMode) return "View Sample Item";
    if (isEditMode) return "Edit Sample Item";
    return "Create New Sample Item";
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{getTitle()}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter item name" 
                        {...field} 
                        disabled={isViewMode}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter description" 
                        {...field} 
                        disabled={isViewMode}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      {isViewMode ? (
                        <div>
                          <Badge variant={field.value === "ACTIVE" ? "default" : "secondary"} className={field.value === "ACTIVE" ? "bg-green-600" : ""}>
                            {field.value}
                          </Badge>
                        </div>
                      ) : (
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="INACTIVE">Inactive</SelectItem>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="ARCHIVED">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isViewMode && existingItem?.data && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div>
                    <h3 className="text-base font-medium">Additional Information</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">ID</span>
                      <p className="font-medium">{existingItem.data.id}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created At</span>
                      <p className="font-medium">{new Date(existingItem.data.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Updated At</span>
                      <p className="font-medium">{new Date(existingItem.data.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/sample/sub-menu/items")}
                >
                  {isViewMode ? "Back to List" : "Cancel"}
                </Button>
                {isViewMode ? (
                  canUpdate && (
                    <Button type="button" onClick={handleEditClick}>
                      Edit
                    </Button>
                  )
                ) : (
                  (isEditMode ? canUpdate : canCreate) && (
                    <Button type="submit" disabled={mutation.isPending}>
                      {mutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
                      {isEditMode ? "Update Item" : "Create Item"}
                    </Button>
                  )
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SampleItemForm;
