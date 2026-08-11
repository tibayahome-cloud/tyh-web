import { LegalDocumentsPanel } from "../../../../shared/components/LegalDocumentsPanel";

const AdminAccountSettingsPage = () => (
  <div className="space-y-6">
    <header>
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Review account-level resources and current legal documents.</p>
    </header>

    <LegalDocumentsPanel />
  </div>
);

export default AdminAccountSettingsPage;
