import CssBaseline from "@mui/material/CssBaseline";
import { StyledEngineProvider } from "@mui/material/styles";
import { ThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";

import { appTheme } from "../../shared/libs/theme";

type ThemeProviderProps = {
  children: ReactNode;
};

export const AppThemeProvider = ({ children }: ThemeProviderProps) => (
  <StyledEngineProvider injectFirst>
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  </StyledEngineProvider>
);

