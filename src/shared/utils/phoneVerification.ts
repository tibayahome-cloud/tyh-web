export const CODE_LENGTH = 6;

// What the person typed, reduced to the digits a code can contain, and no more than a code has. Pasted codes
// often arrive as "123 456" or "123-456".
export const cleanCode = (value: string): string => value.replace(/\D/g, "").slice(0, CODE_LENGTH);

export type DeliveryState = "pending" | "sent" | "failed" | "none";

export const toDeliveryState = (value: unknown): DeliveryState =>
  value === "pending" || value === "sent" || value === "failed" ? value : "none";

// Shown instead of the number's middle, so the person can tell it is the right phone without the screen
// giving the number to anyone looking over their shoulder.
export const maskPhone = (phone: string | null | undefined): string =>
  phone ? `${phone.slice(0, 4)}****${phone.slice(-3)}` : "your phone";
