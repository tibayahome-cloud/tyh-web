// utils/errors.ts
import { AxiosError } from "axios";

export function getApiError(err: unknown, fallback = "Something went wrong"): string {
  const axiosErr = err as AxiosError<{ error: { message: string } }>;
  return axiosErr?.response?.data?.error?.message || (err as Error)?.message || fallback;
}