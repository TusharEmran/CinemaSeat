/**
 * Response types. Keep these in step with backend schemas.
 *
 * Field names are snake_case because that is what the wire carries.
 *
 * Money is integer minor units everywhere (45000 is 450.00 BDT).
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
  description?: string;
  genre?: string;
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
  booking_id?: string;
  booking_ref?: string;
  showtime_id: string;
  seats: HeldSeat[];
  total_minor: number;
  currency: string;
  expires_at: string;
  hold_ttl_seconds: number;
}

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
  booking_id?: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  showtime_id: string;
  movie?: { title: string; rating: string };
  theatre?: { name: string; screen: string };
  starts_at?: string;
  seats: HeldSeat[];
  total_minor: number;
  currency: string;
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
