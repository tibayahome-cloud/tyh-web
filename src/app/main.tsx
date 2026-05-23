import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import "../shared/styles/tailwind.css";

import { router } from "./routes";
import { AppQueryProvider } from "./providers/QueryProvider";
import { AppThemeProvider } from "./providers/ThemeProvider";
import { AppI18nProvider } from "./providers/I18nProvider";
import { SocketProvider } from "./providers/SocketProvider";
import { CapacitorInit } from "./providers/CapacitorProvider";
import { AuthProvider } from "../shared/hooks/useAuth";
import { RefreshGate } from "../auth/RefreshGate";
import { SessionEventBridge } from "./providers/SessionEventBridge";
import { SyncService } from "./providers/SyncService";
import { ToastProvider } from "../shared/components/ToastProvider";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element missing");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <CapacitorInit>
      <AppI18nProvider>
        <AppThemeProvider>
          <AppQueryProvider>
            <ToastProvider>
              <AuthProvider>
                <SocketProvider>
                  <SessionEventBridge />
                  <SyncService />
                  <RefreshGate>
                    <RouterProvider
                      router={router}
                      future={{
                        v7_startTransition: true
                      }}
                    />
                  </RefreshGate>
                </SocketProvider>
              </AuthProvider>
            </ToastProvider>
          </AppQueryProvider>
        </AppThemeProvider>
      </AppI18nProvider>
    </CapacitorInit>
  </React.StrictMode>
);
