import { useId, useRef, useState } from "react";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { ReactNode } from "react";

import { Button } from "./Button";

export type ActionMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
};

type Props = {
  // Visible name of the menu button, e.g. "Manage". The accessible name adds the subject.
  label: string;
  // What the menu acts on, e.g. the facility name, so several menus on one page stay distinguishable.
  subject?: string;
  items: ActionMenuItem[];
};

// A labelled group of secondary actions. Built on MUI's Menu, which supplies the keyboard model:
// Enter or Down arrow opens it, arrows move, Escape closes and returns focus to the button.
export const ActionMenu = ({ label, subject, items }: Props) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  if (items.length === 0) return null;
  return (
    <>
      <Button
        ref={buttonRef}
        size="sm"
        variant="outline"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? `${id}-menu` : undefined}
        aria-label={subject ? `${label} ${subject}` : label}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        {label}
        <ExpandMoreIcon fontSize="small" aria-hidden="true" />
      </Button>
      <Menu id={`${id}-menu`} anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} MenuListProps={{ "aria-label": subject ? `${label} ${subject}` : label }}>
        {items.map((item) => (
          <MenuItem
            key={item.key}
            disabled={item.disabled}
            onClick={() => {
              setAnchor(null);
              item.onSelect();
            }}
          >
            {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
