import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import type { ReactNode } from "react";

import { Button } from "./Button";

type ConfirmDialogProps = {
  open: boolean;
  title?: ReactNode;
  description?: string;
  error?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
};

export const ConfirmDialog = ({
  open,
  title = "Are you sure?",
  description,
  error,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  loading,
  onConfirm,
  onClose,
  children
}: ConfirmDialogProps) => {
  return (
    <Dialog
      disablePortal={false}
      container={() => document.body}
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      {(description || error || children) && (
        <DialogContent>
          {description && <DialogContentText>{description}</DialogContentText>}
          {children}
          {error && (
            <DialogContentText sx={{ color: "error.main", mt: description || children ? 1.5 : 0 }}>
              {error}
            </DialogContentText>
          )}
        </DialogContent>
      )}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
