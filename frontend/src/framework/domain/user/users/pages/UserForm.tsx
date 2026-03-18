import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@shared/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Spinner } from "@shared/components/ui/spinner";
import { Switch } from "@shared/components/ui/switch";
import { Checkbox } from "@shared/components/ui/checkbox";
import { Label } from "@shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@shared/components/ui/radio-group";
import { Badge } from "@shared/components/ui/badge";
import { createUser, updateUser, getUser, getRoles, assignRoles } from "../api/users.api";
import { usePermissionStore } from "@core/auth/stores/permissionStore";

type FormMode = "create" | "edit" | "view";

const formSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  active: z.boolean().optional(),
  passwordDelivery: z.enum(["email", "manual"]).optional(),
  temporaryPassword: z.string().optional(),
}).refine((data) => {
  if (data.passwordDelivery === "manual") {
    return data.temporaryPassword && data.temporaryPassword.length >= 8;
  }
  return true;
}, {
  message: "Temporary password must be at least 8 characters",
  path: ["temporaryPassword"],
});

type FormValues = z.infer<typeof formSchema>;

export const UserForm = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Determine mode: view (from query param), edit (has id), or create (no id)
  const mode: FormMode = searchParams.get("mode") === "view" ? "view" : id ? "edit" : "create";
  const isViewMode = mode === "view";
  const isEditMode = mode === "edit";
  const isCreateMode = mode === "create";
  
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  
  const { hasPermission } = usePermissionStore();
  const canUpdate = hasPermission('admin.users:update');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      active: true,
      passwordDelivery: "email",
      temporaryPassword: "",
    },
  });

  const passwordDelivery = form.watch("passwordDelivery");

  const { data: existingUser, isLoading: isLoadingUser } = useQuery({
    queryKey: ["user", id],
    queryFn: () => getUser(id!),
    enabled: !!id,
  });

  const { data: rolesData, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: getRoles,
    enabled: !!id,
  });

  useEffect(() => {
    if (existingUser?.data) {
      form.reset({
        email: existingUser.data.email,
        firstName: existingUser.data.firstName || "",
        lastName: existingUser.data.lastName || "",
        active: existingUser.data.active,
        passwordDelivery: "email",
        temporaryPassword: "",
      });
      if (existingUser.data.roles) {
        setSelectedRoleIds(existingUser.data.roles.map(r => r.id));
      }
    }
  }, [existingUser, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (isEditMode) {
        return updateUser({ id: id!, data: { firstName: values.firstName, lastName: values.lastName, active: values.active } });
      }
      return createUser({
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        temporaryPassword: values.passwordDelivery === "manual" ? values.temporaryPassword : undefined,
      });
    },
    onSuccess: (_, values) => {
      if (isEditMode) {
        toast.success("User updated successfully");
      } else if (values.passwordDelivery === "email") {
        toast.success("User created successfully. An email invitation has been sent.");
      } else {
        toast.success("User created successfully with the specified password.");
      }
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to save user: ${error.message}`);
    },
  });

  const rolesMutation = useMutation({
    mutationFn: () => assignRoles({ id: id!, data: { roleIds: selectedRoleIds } }),
    onSuccess: () => {
      toast.success("Roles updated successfully");
      queryClient.invalidateQueries({ queryKey: ["user", id] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update roles: ${error.message}`);
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await mutation.mutateAsync(values);
      
      if (isEditMode) {
        const originalRoleIds = existingUser?.data?.roles.map(r => r.id) || [];
        const sortedOriginal = [...originalRoleIds].sort((a, b) => a - b);
        const sortedSelected = [...selectedRoleIds].sort((a, b) => a - b);
        
        const rolesChanged = JSON.stringify(sortedOriginal) !== JSON.stringify(sortedSelected);
        
        if (rolesChanged) {
          await rolesMutation.mutateAsync();
        }
      }
      navigate("/user/users");
    } catch (error) {
    }
  };

  const handleRoleToggle = (roleId: number, checked: boolean) => {
    setSelectedRoleIds(prev => 
      checked ? [...prev, roleId] : prev.filter(id => id !== roleId)
    );
  };

  const handleEditClick = () => {
    navigate(`/user/users/${id}`);
  };

  if (id && isLoadingUser) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner className="size-10" />
      </div>
    );
  }

  const getTitle = () => {
    if (isViewMode) return "View User";
    if (isEditMode) return "Edit User";
    return "Create User";
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email"
                        placeholder="user@example.com" 
                        {...field} 
                        disabled={isEditMode || isViewMode}
                      />
                    </FormControl>
                    {isEditMode && (
                      <FormDescription>Email cannot be changed after creation</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter first name" 
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
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter last name" 
                          {...field} 
                          disabled={isViewMode}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isCreateMode && (
                <FormField
                  control={form.control}
                  name="passwordDelivery"
                  render={({ field }) => (
                    <FormItem className="space-y-3 rounded-lg border p-4">
                      <FormLabel className="text-base font-medium">Password Delivery</FormLabel>
                      <FormDescription>
                        Choose how the user will receive their initial login credentials
                      </FormDescription>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-2"
                        >
                          <div className="flex items-center space-x-3">
                            <RadioGroupItem value="email" id="email" />
                            <Label htmlFor="email" className="flex flex-col cursor-pointer">
                              <span className="font-medium">Send email invitation</span>
                              <span className="text-sm text-muted-foreground">
                                User will receive an email with a temporary password
                              </span>
                            </Label>
                          </div>
                          <div className="flex items-center space-x-3">
                            <RadioGroupItem value="manual" id="manual" />
                            <Label htmlFor="manual" className="flex flex-col cursor-pointer">
                              <span className="font-medium">Set temporary password</span>
                              <span className="text-sm text-muted-foreground">
                                You'll set a password to share with the user manually
                              </span>
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {isCreateMode && passwordDelivery === "manual" && (
                <FormField
                  control={form.control}
                  name="temporaryPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temporary Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password"
                          placeholder="Enter temporary password (min 8 characters)" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        The user will be required to change this password on first login
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {(isEditMode || isViewMode) && (
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active Status</FormLabel>
                        <FormDescription>
                          {isViewMode ? "User account status" : "Deactivating will disable the user's access"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        {isViewMode ? (
                          <Badge variant={field.value ? "default" : "secondary"} className={field.value ? "bg-green-600" : ""}>
                            {field.value ? "Active" : "Inactive"}
                          </Badge>
                        ) : (
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              {(isEditMode || isViewMode) && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div>
                    <h3 className="text-base font-medium">Roles</h3>
                    <p className="text-sm text-muted-foreground">
                      {isViewMode ? "Roles assigned to this user" : "Assign roles to this user"}
                    </p>
                  </div>
                  {isLoadingRoles ? (
                    <Spinner className="size-6" />
                  ) : isViewMode ? (
                    <div className="flex flex-wrap gap-2">
                      {existingUser?.data?.roles?.length ? (
                        existingUser.data.roles.map((role) => (
                          <Badge key={role.id} variant="outline">
                            {role.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No roles assigned</span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rolesData?.data?.map((role) => (
                        <div key={role.id} className="flex items-center space-x-3">
                          <Checkbox
                            id={`role-${role.id}`}
                            checked={selectedRoleIds.includes(role.id)}
                            onCheckedChange={(checked) => handleRoleToggle(role.id, checked as boolean)}
                          />
                          <Label htmlFor={`role-${role.id}`} className="flex flex-col">
                            <span className="font-medium">{role.name}</span>
                            {role.description && (
                              <span className="text-sm text-muted-foreground">{role.description}</span>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isViewMode && existingUser?.data && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div>
                    <h3 className="text-base font-medium">Additional Information</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Created At</span>
                      <p className="font-medium">{new Date(existingUser.data.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Updated At</span>
                      <p className="font-medium">{new Date(existingUser.data.updatedAt).toLocaleString()}</p>
                    </div>
                    {existingUser.data.externalUserId && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">External User ID</span>
                        <p className="font-medium font-mono text-xs">{existingUser.data.externalUserId}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/user/users")}
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
                  <Button type="submit" disabled={mutation.isPending || rolesMutation.isPending}>
                    {(mutation.isPending || rolesMutation.isPending) && <Spinner className="mr-2 h-4 w-4" />}
                    {isEditMode ? "Update User" : "Create User"}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserForm;
