import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import type { PropsWithChildren } from "react";

interface ModalProps {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
  fullWidth?: boolean;
  /** If true, forces desktop styling even on mobile */
  disableMobileFullScreen?: boolean;
}

export const Modal = ({
  open,
  title,
  description,
  onClose,
  maxWidth = "sm",
  fullWidth = true,
  disableMobileFullScreen = false,
  children
}: PropsWithChildren<ModalProps>) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const useFullScreen = isMobile && !disableMobileFullScreen;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth={fullWidth}
      fullScreen={useFullScreen}
      maxWidth={maxWidth}
      PaperProps={{
        sx: {
          borderRadius: useFullScreen ? 0 : "24px",
          border: useFullScreen ? "none" : "1px solid rgba(148,163,184,0.35)",
          backgroundImage:
            "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.9)), radial-gradient(circle at 10% 20%, rgba(79,70,229,0.08), transparent 55%)"
        }
      }}
    >
      {(title || description) && (
        <DialogTitle sx={{ pb: description ? 0 : 1, pt: useFullScreen ? 2 : 3 }}>
          {title && <span style={{ display: "block", fontWeight: 600, fontSize: useFullScreen ? "1.1rem" : undefined }}>{title}</span>}
          {description && (
            <span style={{ display: "block", color: "#475569", fontSize: "0.85rem", marginTop: "0.25rem" }}>
              {description}
            </span>
          )}
        </DialogTitle>
      )}
      <DialogContent
        dividers
        sx={{
          borderRadius: useFullScreen ? 0 : 3,
          borderColor: "rgba(148,163,184,0.35)",
          mt: title || description ? 1 : 0,
          backgroundColor: "#fffdfc",
          p: useFullScreen ? 2 : 3
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
};
