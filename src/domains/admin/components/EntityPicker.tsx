import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";

export type PickedEntity = { id: string; label: string; hint?: string };

type EntityPickerProps = {
  label: string;
  placeholder: string;
  value: PickedEntity | null;
  options: PickedEntity[];
  loading?: boolean;
  /** Called as the person types, so the parent can search by name. */
  onSearch?: (text: string) => void;
  onChange: (value: PickedEntity | null) => void;
  emptyText?: string;
};

/** Finds a person or service by name, so nobody has to know or paste an id. */
export const EntityPicker = ({
  label,
  placeholder,
  value,
  options,
  loading,
  onSearch,
  onChange,
  emptyText = "No match. Try another spelling."
}: EntityPickerProps) => {
  const [text, setText] = useState("");
  return (
    <Autocomplete<PickedEntity>
      value={value}
      options={options}
      loading={loading}
      filterOptions={(all) => all}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      getOptionLabel={(option) => option.label}
      noOptionsText={text.trim().length < 2 && onSearch ? "Type at least 2 letters" : emptyText}
      onInputChange={(_event, next, reason) => {
        if (reason === "input") {
          setText(next);
          onSearch?.(next);
        }
      }}
      onChange={(_event, next) => onChange(next)}
      renderOption={(props, option) => (
        <li {...props} key={option.id} style={{ minHeight: 44 }}>
          <span className="flex flex-col">
            <span className="text-sm text-slate-900">{option.label}</span>
            {option.hint && <span className="text-sm text-slate-600">{option.hint}</span>}
          </span>
        </li>
      )}
      renderInput={(params) => <TextField {...params} label={label} placeholder={placeholder} size="small" />}
    />
  );
};
