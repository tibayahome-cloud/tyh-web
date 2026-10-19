import type { ReactNode } from "react";
import type { Control, ControllerFieldState, ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { Controller } from "react-hook-form";

type RenderArgs<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> = {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
};

export type FormFieldRender<TFieldValues extends FieldValues, TName extends Path<TFieldValues> = Path<TFieldValues>> = (
  args: RenderArgs<TFieldValues, TName>
) => ReactNode;

// `TName` is inferred from `name`, so `field.value` has the type of that one field instead of the union of
// every field in the form.
export interface FormFieldProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> {
  control: Control<TFieldValues>;
  name: TName;
  render: FormFieldRender<TFieldValues, TName>;
}

export function FormField<TFieldValues extends FieldValues, TName extends Path<TFieldValues>>({
  control,
  name,
  render
}: FormFieldProps<TFieldValues, TName>) {
  return <Controller control={control} name={name} render={({ field, fieldState }) => <>{render({ field, fieldState })}</>} />;
}
