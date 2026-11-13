export const formatMoney = (cents: number, currency = "KES"): string =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

export const formatKm = (km: number): string => (km < 1 ? "less than 1 km" : `${km.toFixed(km < 10 ? 1 : 0)} km`);

/** The value a datetime-local field wants for "this long from now", in the device's own time. */
export const localInputValue = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** What the visitor reads about cost. A clinic that has set no price yet is not shown as "KES 0". */
export const paidAfterLine = (cents: number, currency = "KES"): string =>
  cents > 0 ? `It costs ${formatMoney(cents, currency)}, paid after the visit.` : "The clinic confirms the price. You pay after the visit.";
