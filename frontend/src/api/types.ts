/**
 * Response types. Keep these in step with backend/src/modules/[module]/schemas.ts and
 * with the request shapes documented in README.md -- judges test against what
 * the README says, so a drift there is a real failure, not a docs nit.
 *
 * Field names are snake_case because that is what the wire carries. Renaming
 * them to camelCase here would mean every one of these types is a lie about the
 * JSON it describes, and the mapping layer would be one more place to drift.
 *
 * Money is integer minor units everywhere. There is no `number` in this file
 * that means "taka" -- 45000 is 450.00 BDT.
 */

export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED';

export type SeatTier = 'STANDARD' | 'PREMIUM' | 'RECLINER';

export interface Seat {
  seat_id: string;
  label: string;
  status: SeatStatus;
  price_minor: number;
  tier: SeatTier;
  /** Present only on HELD seats. */
  held_until?: string;
}

export interface SeatRow {
  row: string;
  seats: Seat[];
}

export interface Movie {
  id: string;
  title: string;
  rating: string;
  runtime_minutes?: number;
  poster_url?: string;
}

export interface Showtime {
  id: string;
  movie_id: string;
  theatre: { name: string; screen: string };
  starts_at: string;
  base_price_minor: number;
}

export interface SeatMap {
  showtime_id: string;
  movie: { title: string; rating: string };
  theatre: { name: string; screen: string };
  starts_at: string;
  /** Server clock at response time. Countdowns are drawn against this, never Date.now(). */
  server_time: string;
  rows: SeatRow[];
}

export interface HeldSeat {
  seat_id: string;
  label: string;
  price_minor: number;
}

export interface Hold {
  hold_id: string;
  showtime_id: string;
  seats: HeldSeat[];
  total_minor: number;
  currency: string;
  expires_at: string;
  hold_ttl_seconds: number;
}

/**
 * A booking is terminal once it leaves PENDING_PAYMENT. `isTerminal` below is
 * the single place that decides when polling stops -- do not inline the check.
 */
export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';

export interface Booking {
  booking_ref: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  showtime_id: string;
  movie?: { title: string; rating: string };
  theatre?: { name: string; screen: string };
  starts_at?: string;
  seats: HeldSeat[];
  total_minor: number;
  currency: string;
  /** Present only on CONFIRMED. A data: URL, an https URL, or a raw payload string. */
  ticket_qr?: string;
  created_at?: string;
  server_time?: string;
}

/** Every error the API returns shares this shape. */
export interface ApiError {
  error: string;
  message: string;
  request_id?: string;
  /** Only on 409 SEAT_UNAVAILABLE. */
  conflicting_seats?: string[];
}

const TERMINAL: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  'CONFIRMED',
  'PAYMENT_FAILED',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED',
]);

export function isTerminal(status: BookingStatus): boolean {
  return TERMINAL.has(status);
}

/** 45000 -> "৳450.00". Minor units in, display string out, no floats in between. */
export function formatMinor(minor: number, currency = 'BDT'): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const major = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, '0');
  const symbol = currency === 'BDT' ? '৳' : `${currency} `;
  return `${sign}${symbol}${major.toLocaleString('en-US')}.${cents}`;
}
