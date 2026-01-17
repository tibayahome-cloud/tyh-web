import { useAuth } from "../../../shared/hooks/useAuth";

const fields = [
  { label: "Full name", placeholder: "Your legal name" },
  { label: "Phone number", placeholder: "+254..." },
  { label: "Email", placeholder: "name@example.com" }
];

const ProviderProfile = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Profile</p>
        <h1 className="text-2xl font-semibold text-slate-900">Personal details</h1>
        <p className="text-sm text-slate-500">Update your public information and contact preferences.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="grid gap-6">
          {fields.map((field) => (
            <label key={field.label} className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              {field.label}
              <input
                type="text"
                placeholder={field.placeholder}
                defaultValue={field.label === "Full name" ? user?.fullName ?? "" : user?.email ?? ""}
                className="rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </label>
          ))}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            Save changes
          </button>
        </form>
      </section>
    </div>
  );
};

export default ProviderProfile;
