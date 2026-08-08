/**
 * The only file that knows the API exists.
 *
 * Base URL is `/api` -- same origin, through the proxy. The frontend never
 * learns the API host, so there is nothing to reconfigure between local and
 * deployed.
 *
 * Two rules this client enforces for callers:
 *   - a 409 on hold is a RESULT, not an exception. Return it typed; do not
 *     throw, or every call site grows a try/catch around normal behaviour.
 *   - /pay returns 202, never an outcome. Callers must poll the booking.
 */

import type {
  ApiError,
  Booking,
  Hold,
  Movie,
  SeatMap,
  Showtime,
} from './types';

const BASE = '/api';

/**
 * Thrown for any non-2xx the caller did not ask to handle as a result.
 * Carries the server's error envelope when there was one, so a call site can
 * branch on `code` (HOLD_EXPIRED, GATEWAY_UNAVAILABLE, …) without re-parsing.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly body?: ApiError;

  constructor(status: number, body?: ApiError) {
    super(body?.message ?? `Request failed with ${status}`);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = body?.error ?? 'UNKNOWN';
    this.requestId = body?.request_id;
    this.body = body;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Status codes to hand back to the caller instead of throwing. */
  expect?: number[];
}

interface RawResponse<T> {
  status: number;
  data: T;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<RawResponse<T>> {
  const { method = 'GET', body, headers = {}, signal, expect = [] } = options;

  const response = await fetch(`${BASE}${path}`, {
    method,
    signal,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // 204 has no body by definition; parsing it would throw on valid responses.
  const data =
    response.status === 204 || response.headers.get('content-length') === '0'
      ? (undefined as T)
      : ((await response.json().catch(() => undefined)) as T);

  if (response.ok || expect.includes(response.status)) {
    return { status: response.status, data };
  }

  throw new ApiRequestError(response.status, data as unknown as ApiError);
}

/* -- Catalog --------------------------------------------------------------- */

export async function getMovies(signal?: AbortSignal): Promise<Movie[]> {
  const { data } = await request<{ movies: Movie[] }>('/movies', { signal });
  return data.movies;
}

export async function getShowtimes(movieId: string, signal?: AbortSignal): Promise<Showtime[]> {
  const { data } = await request<{ showtimes: Showtime[] }>(
    `/movies/${encodeURIComponent(movieId)}/showtimes`,
    { signal },
  );
  return data.showtimes;
}

/* -- Seating --------------------------------------------------------------- */

export function getSeatMap(showtimeId: string, signal?: AbortSignal): Promise<SeatMap> {
  return request<SeatMap>(`/showtimes/${encodeURIComponent(showtimeId)}/seatmap`, {
    signal,
  }).then((r) => r.data);
}

/**
 * Losing the race is the expected answer for 99 of 100 concurrent requests, so
 * it comes back as `{ held: false }` rather than an exception.
 */
export type HoldResult =
  | { held: true; hold: Hold }
  | { held: false; conflict: ApiError };

export async function holdSeats(
  input: { showtimeId: string; seatLabels: string[]; userRef: string; idempotencyKey?: string },
  signal?: AbortSignal,
): Promise<HoldResult> {
  const { status, data } = await request<Hold | ApiError>('/holds', {
    method: 'POST',
    signal,
    expect: [409],
    headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {},
    body: {
      showtime_id: input.showtimeId,
      seat_labels: input.seatLabels,
      user_ref: input.userRef,
    },
  });

  return status === 409
    ? { held: false, conflict: data as ApiError }
    : { held: true, hold: data as Hold };
}

/** Idempotent by contract — releasing an already-released hold is a 204. */
export async function releaseHold(holdId: string, signal?: AbortSignal): Promise<void> {
  await request<void>(`/holds/${encodeURIComponent(holdId)}`, { method: 'DELETE', signal });
}

/* -- Booking --------------------------------------------------------------- */

/** Throws `ApiRequestError` with code `HOLD_EXPIRED` (410) if the hold died first. */
export async function createBooking(
  holdId: string,
  phone: string,
  signal?: AbortSignal,
): Promise<Booking> {
  const { data } = await request<Booking>('/bookings', {
    method: 'POST',
    signal,
    body: { hold_id: holdId, phone },
  });
  return data;
}

export async function sendOtp(ref: string, signal?: AbortSignal): Promise<void> {
  await request<void>(`/bookings/${encodeURIComponent(ref)}/otp/send`, {
    method: 'POST',
    signal,
  });
}

export async function verifyOtp(ref: string, code: string, signal?: AbortSignal): Promise<void> {
  await request<void>(`/bookings/${encodeURIComponent(ref)}/otp/verify`, {
    method: 'POST',
    signal,
    body: { code },
  });
}

export interface PayAccepted {
  booking_ref: string;
  payment_status: 'PENDING';
  poll: string;
}

/**
 * Returns 202 and nothing more. This is not an outcome -- the callback is 2-15
 * seconds behind, so the caller must poll `getBooking` until terminal.
 */
export async function pay(ref: string, signal?: AbortSignal): Promise<PayAccepted> {
  const { data } = await request<PayAccepted>(`/bookings/${encodeURIComponent(ref)}/pay`, {
    method: 'POST',
    signal,
  });
  return data;
}

export function getBooking(ref: string, signal?: AbortSignal): Promise<Booking> {
  return request<Booking>(`/bookings/${encodeURIComponent(ref)}`, { signal }).then((r) => r.data);
}
