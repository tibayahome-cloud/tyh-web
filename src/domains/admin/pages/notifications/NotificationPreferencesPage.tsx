import { NotificationPreferencesPanel } from "../../../../shared/components/NotificationPreferencesPanel";

const NotificationPreferencesPage = () => {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Notification preferences</h1>
        <p className="text-sm text-slate-500">
          Toggle delivery channels per-event, snooze noisy alerts, and keep the ops team aligned with escalation policy.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <NotificationPreferencesPanel />
      </div>
    </div>
  );
};

export default NotificationPreferencesPage;
