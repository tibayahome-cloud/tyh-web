import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

import i18n from "../../shared/i18n";

type I18nProviderProps = {
  children: ReactNode;
};

export const AppI18nProvider = ({ children }: I18nProviderProps) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

