import { alpha, createTheme } from "@mui/material/styles";

const brandPrimary = "#4f46e5";
const brandPrimaryLight = "#6366f1";
const brandPrimaryDark = "#312e81";
const brandSecondary = "#0ea5e9";
const neutral900 = "#0f172a";
const neutral600 = "#475569";

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: brandPrimary,
      light: brandPrimaryLight,
      dark: brandPrimaryDark,
      contrastText: "#ffffff"
    },
    secondary: {
      main: brandSecondary,
      contrastText: "#04121f"
    },
    success: {
      main: "#22c55e"
    },
    warning: {
      main: "#f59e0b"
    },
    error: {
      main: "#ef4444"
    },
    info: {
      main: "#14b8a6"
    },
    background: {
      default: "#f8fafc",
      paper: "#ffffff"
    },
    text: {
      primary: neutral900,
      secondary: neutral600
    },
    divider: "rgba(15, 23, 42, 0.08)"
  },
  typography: {
    fontFamily: "'Inter', 'Inter var', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h1: { fontSize: "3rem", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.04em" },
    h2: { fontSize: "2.25rem", fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.035em" },
    h3: { fontSize: "1.875rem", fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.03em" },
    h4: { fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.3 },
    h5: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.35 },
    h6: { fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.4 },
    subtitle1: { fontSize: "1rem", fontWeight: 500, lineHeight: 1.45 },
    subtitle2: { fontSize: "0.95rem", fontWeight: 500, lineHeight: 1.45 },
    body1: { fontSize: "1rem", lineHeight: 1.6 },
    body2: { fontSize: "0.9375rem", lineHeight: 1.55 },
    button: { fontWeight: 600, textTransform: "none", letterSpacing: 0.01 }
  },
  shape: {
    borderRadius: 16
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(79,70,229,0.05), transparent 45%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.05), transparent 55%)"
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: "1.25rem",
          paddingBlock: "0.625rem",
          fontWeight: 600,
          transition: "transform 150ms ease, box-shadow 150ms ease",
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: "0 12px 30px -12px rgba(79, 70, 229, 0.45)"
          }
        },
        containedSecondary: {
          color: "#04121f"
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 24,
          boxShadow: "0 30px 80px -35px rgba(15, 23, 42, 0.35)"
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 28,
          padding: "0.5rem",
          boxShadow: "0 40px 90px -45px rgba(15, 23, 42, 0.45)"
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 24,
          border: "1px solid rgba(148, 163, 184, 0.25)",
          boxShadow: "0 30px 80px -55px rgba(15, 23, 42, 0.45)"
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14
        },
        notchedOutline: {
          borderColor: alpha(neutral900, 0.12)
        }
      }
    }
  }
});
