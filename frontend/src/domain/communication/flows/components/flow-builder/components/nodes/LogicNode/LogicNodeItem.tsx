import { Checkbox } from "@shared/components/ui/checkbox.tsx";
import { Input } from "@shared/components/ui/input.tsx";
import { Label } from "@shared/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/select";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import "./style.css";
import { Combobox } from "@shared/components/ui/combobox.tsx";

const logicOperations = {
  number: ["=", "!=", ">", "<", ">=", "<="],
};

interface Attribute {
  type: string;
  label: string;
  name: string;
}

interface FormValues {
  rules: Array<{
    attributeId?: string;
    conditionOp?: string;
    conditionValue?: string | boolean | null;
  }>;
}

interface NumberInputProps {
  form: UseFormReturn<FormValues>;
  index: number;
}

const NumberInput = ({ form, index }: NumberInputProps) => {
  const { control } = form || {};
  return (
    <>
      <div className="mb-4">
        <Label className="mb-2">OPERATOR</Label>
        <Controller
          name={`rules.${index}.conditionOp`}
          control={control}
          defaultValue={undefined}
          render={({ field, fieldState }) => (
            <Select
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
            >
              <SelectTrigger
                id=""
                aria-invalid={fieldState.invalid}
                className=""
              >
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent position="item-aligned">
                {logicOperations.number.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="mb-4">
        <Label className="mb-2">VALUE</Label>
        <Controller
          name={`rules.${index}.conditionValue`}
          control={control}
          defaultValue={undefined}
          render={({ field }) => (
            <Input
              {...field}
              value={String(field.value || "")}
              className="min-w-12"
            />
          )}
        />
      </div>
    </>
  );
};

interface BooleanInputProps {
  form: UseFormReturn<FormValues>;
  index: number;
}

const BooleanInput = ({ form, index }: BooleanInputProps) => {
  const { control } = form || {};
  return (
    <div className="mb-4">
      <Label className="mb-2">VALUE</Label>
      <Controller
        name={`rules.${index}.conditionValue`}
        control={control}
        defaultValue={false}
        render={({ field }) => (
          <Checkbox
            name={field.name}
            checked={!!field.value}
            onCheckedChange={field.onChange}
            defaultChecked={false}
          />
        )}
      />
    </div>
  );
};

interface LogicNodeItemProps {
  attributes: Attribute[];
  form: UseFormReturn<FormValues>;
  index: number;
}

export const LogicNodeItem = ({ attributes, form, index }: LogicNodeItemProps) => {
  const { control, setValue } = form || {};
  const attributeId = useWatch({
    control,
    name: `rules.${index}.attributeId`,
  });
  const currItem = attributes.find((attr: Attribute) => attr.name === attributeId);
  const nodeType = currItem?.type;

  const getInput = () => {
    if (nodeType === "string" || nodeType === "number") {
      return (
        <NumberInput
          form={form}
          index={index}
        />
      );
    } else if (nodeType === "boolean") {
      return (
        <BooleanInput
          form={form}
          index={index}
        />
      );
    } else {
      return null;
    }
  };

  return (
    <>
      <div className="mb-4">
        <Label className="mb-2">CONDITION TYPE</Label>
        <Controller
          name={`rules.${index}.attributeId`}
          control={control}
          render={({ field }) => (
            <Combobox
              value={field.value}
              onValueChange={(val) => {
                setValue(`rules.${index}.conditionValue`, undefined);
                setValue(`rules.${index}.conditionOp`, undefined);
                field.onChange(val);
              }}
              options={attributes && attributes.map((option: Attribute) => ({
                value: option.name,
                label: option.label,
              }))}
              placeholder="Select"
            />
          )}
        />
      </div>
      {getInput()}
    </>
  );
};

export default LogicNodeItem;
