import classNames from "classnames";
import { useState } from "react";

import { ServiceCatalogPanel } from "./CatalogPage";
import { ServiceListPanel } from "./ServiceListPage";
import { ServiceLocalizationPanel } from "./LocalizationPage";

const tabs = [
  { key: "categories", label: "Categories" },
  { key: "services", label: "Services" },
  { key: "localization", label: "Localization" }
] as const;

type TabKey = (typeof tabs)[number]["key"];

const ServiceManagementPage = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("categories");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Service workspace</h1>
          <p className="text-sm text-slate-500">
            Configure categories, manage localized metadata, and tune offerings without leaving this screen.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm font-medium text-slate-600 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={classNames(
                "rounded-full border px-4 py-1.5 text-sm font-semibold transition",
                activeTab === tab.key
                  ? "border-primary-200 bg-primary-50 text-primary-800 shadow-inner"
                  : "border-transparent text-slate-600 hover:text-primary-600"
              )}
              aria-pressed={activeTab === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "categories" && <ServiceCatalogPanel />}
      {activeTab === "services" && <ServiceListPanel />}
      {activeTab === "localization" && <ServiceLocalizationPanel />}
    </div>
  );
};

export default ServiceManagementPage;
