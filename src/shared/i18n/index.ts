import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./en/common.json";
import swCommon from "./sw/common.json";

const resources = {
  en: {
    common: enCommon
  },
  sw: {
    common: swCommon
  }
} as const;

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: "en",
    fallbackLng: "en",
    defaultNS: "common",
    interpolation: {
      escapeValue: false
    }
  });
}

export default i18n;

