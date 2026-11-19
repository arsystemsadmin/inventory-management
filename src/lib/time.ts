export const PAY_REFRESH_MS = 30 * 60 * 1000; // live pay figures refresh every 30 minutes

export type ShiftWithPay = {
  id: string; profile_id: string; store_id: string; clock_in: string; clock_out: string | null;
  hourly_rate_cents_snapshot: number; note: string | null; is_open: boolean; worked_minutes: number; amount_cents: number;
};
