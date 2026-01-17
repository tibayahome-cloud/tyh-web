import type { ReactNode } from "react";
import type { Control, ControllerFieldState, ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { Controller } from "react-hook-form";

type RenderArgs<TFieldValues extends FieldValues> = {
  field: ControllerRenderProps<TFieldValues>;
  fieldState: ControllerFieldState;
};

export type FormFieldRender<TFieldValues extends FieldValues> = (
  args: RenderArgs<TFieldValues>
) => ReactNode;

export interface FormFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  render: FormFieldRender<TFieldValues>;
}

export function FormField<TFieldValues extends FieldValues>({
  control,
  name,
  render
}: FormFieldProps<TFieldValues>) {
  return <Controller control={control} name={name} render={({ field, fieldState }) => render({ field, fieldState })} />;
}

