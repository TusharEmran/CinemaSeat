/**
 * Frontend API client connected directly to CinemaSeat backend.
 *
 * Base URL is `/api` -- same origin through proxy or Next.js rewrites.
 */

import type {
  ApiError,
  Booking,
  BookingStatus,
  Hold,
  Movie,
  Seat,
  SeatMap,
  SeatRow,
  SeatStatus,
  SeatTier,
  Showtime,
} from './types';

const NEXT_PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

const BASE = typeof window === 'undefined'
  ? (process.env.INTERNAL_API_URL || 'http://api:3000/api')
  : `${NEXT_PUBLIC_BASE_PATH}/api`;

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

  const data =
    response.status === 204 || response.headers.get('content-length') === '0'
      ? (undefined as T)
      : ((await response.json().catch(() => undefined)) as T);

  if (response.ok || expect.includes(response.status)) {
    return { status: response.status, data };
  }

  const errorBody = (data as any)?.error
    ? typeof (data as any).error === 'object'
      ? (data as any).error
      : data
    : data;

  throw new ApiRequestError(response.status, errorBody as ApiError);
}

/* -- Catalog --------------------------------------------------------------- */

export async function getMovies(signal?: AbortSignal): Promise<Movie[]> {
  try {
    const { data } = await request<any>('/movies', { signal });
    const rawList = Array.isArray(data) ? data : data?.data || data?.movies || [];

    return rawList.map((m: any) => ({
      id: m.id,
      title: m.title,
      rating: m.rating || 'PG-13',
      runtime_minutes: m.duration_minutes || m.runtime_minutes || 120,
      poster_url: m.poster_url || m.posterUrl || '',
      description: m.description,
      genre: m.genre,
    }));
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError(500, { error: 'NETWORK_ERROR', message: 'Could not connect to cinema catalog' });
  }
}

export async function getShowtimes(movieId: string, signal?: AbortSignal): Promise<Showtime[]> {
  try {
    let rawList: any[] = [];

    try {
      const path = movieId ? `/shows?movie_id=${encodeURIComponent(movieId)}` : '/shows';
      const { data } = await request<any>(path, { signal });
      rawList = Array.isArray(data) ? data : data?.data || data?.shows || [];
    } catch {
      const { data } = await request<any>(`/movies/${encodeURIComponent(movieId)}/showtimes`, { signal });
      rawList = Array.isArray(data) ? data : data?.data || data?.showtimes || [];
    }

    return rawList.map((s: any) => {
      const priceVal = parseFloat(String(s.price || s.base_price_minor || '450'));
      const priceMinor = s.base_price_minor && s.base_price_minor > 1000
        ? s.base_price_minor
        : Math.round(priceVal * 100);

      return {
        id: s.id,
        movie_id: s.movie_id || movieId,
        theatre: {
          name: s.theatre_name || s.theatre?.name || 'Cineplex Star Cinema',
          screen: s.screen_name || s.theatre?.screen || 'Hall 1 (IMAX)',
        },
        starts_at: s.start_time || s.starts_at || new Date().toISOString(),
        base_price_minor: priceMinor,
      };
    });
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError(500, { error: 'NETWORK_ERROR', message: 'Could not load showtimes' });
  }
}

/* -- Seating --------------------------------------------------------------- */

export async function getSeatMap(showtimeId: string, signal?: AbortSignal): Promise<SeatMap> {
  try {
    let seatsRaw: any[] = [];
    let showRaw: any = null;

    try {
      const [seatsRes, showRes] = await Promise.all([
        request<any>(`/shows/${encodeURIComponent(showtimeId)}/seats`, { signal }),
        request<any>(`/shows/${encodeURIComponent(showtimeId)}`, { signal }),
      ]);
      seatsRaw = Array.isArray(seatsRes.data) ? seatsRes.data : seatsRes.data?.data || [];
      showRaw = showRes.data?.data || showRes.data || {};
    } catch {
      const res = await request<any>(`/showtimes/${encodeURIComponent(showtimeId)}/seatmap`, { signal });
      if (res.data?.rows) return res.data as SeatMap;
    }

    const movieTitle = showRaw.movie_title || showRaw.movie?.title || 'Featured Film';
    const movieRating = showRaw.rating || showRaw.movie?.rating || 'PG-13';
    const theatreName = showRaw.theatre_name || showRaw.theatre?.name || 'Cineplex Star Cinema';
    const screenName = showRaw.screen_name || showRaw.theatre?.screen || 'Hall 1';
    const startsAt = showRaw.start_time || showRaw.starts_at || new Date().toISOString();

    const rowMap = new Map<string, Seat[]>();

    for (const item of seatsRaw) {
      const row = item.row_number || 'A';
      const number = item.seat_number || 1;
      const label = `${row}${number}`;

      const rawStatus = (item.effective_status || item.status || 'AVAILABLE').toUpperCase();
      const status: SeatStatus =
        rawStatus === 'HELD' ? 'HELD' : rawStatus === 'BOOKED' ? 'BOOKED' : 'AVAILABLE';

      const rawType = (item.seat_type || 'STANDARD').toUpperCase();
      const tier: SeatTier =
        rawType === 'VIP' || rawType === 'PREMIUM'
          ? 'PREMIUM'
          : rawType === 'RECLINER'
          ? 'RECLINER'
          : 'STANDARD';

      const priceVal = parseFloat(String(item.price || showRaw.price || '450'));
      const priceMinor = item.price_minor || Math.round(priceVal * 100);

      const seat: Seat = {
        seat_id: item.seat_id || item.id,
        label,
        status,
        price_minor: priceMinor,
        tier,
        ...(item.hold_until ? { held_until: item.hold_until } : {}),
      };

      const existing = rowMap.get(row) || [];
      existing.push(seat);
      rowMap.set(row, existing);
    }

    const rows: SeatRow[] = Array.from(rowMap.entries())
      .sort(([r1], [r2]) => r1.localeCompare(r2))
      .map(([row, seats]) => ({
        row,
        seats: seats.sort((a, b) => {
          const n1 = parseInt(a.label.slice(1), 10) || 0;
          const n2 = parseInt(b.label.slice(1), 10) || 0;
          return n1 - n2;
        }),
      }));

    return {
      showtime_id: showtimeId,
      movie: { title: movieTitle, rating: movieRating },
      theatre: { name: theatreName, screen: screenName },
      starts_at: startsAt,
      server_time: new Date().toISOString(),
      rows,
    };
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    throw new ApiRequestError(500, { error: 'NETWORK_ERROR', message: 'Could not load seat map' });
  }
}

export type HoldResult =
  | { held: true; hold: Hold }
  | { held: false; conflict: ApiError };

export async function holdSeats(
  input: { showtimeId: string; seatLabels?: string[]; seatIds?: string[]; userRef?: string; idempotencyKey?: string },
  signal?: AbortSignal,
): Promise<HoldResult> {
  let targetSeatIds: string[] = input.seatIds || [];

  if (targetSeatIds.length === 0 && input.seatLabels && input.seatLabels.length > 0) {
    try {
      const seatMap = await getSeatMap(input.showtimeId, signal);
      const labelSet = new Set(input.seatLabels);

      for (const row of seatMap.rows) {
        for (const seat of row.seats) {
          if (labelSet.has(seat.label)) {
            targetSeatIds.push(seat.seat_id);
          }
        }
      }
    } catch {
      // fallback if seat lookup fails
    }
  }

  const headers: Record<string, string> = input.idempotencyKey
    ? { 'Idempotency-Key': input.idempotencyKey }
    : {};

  let status: number;
  let data: any;

  try {
    const res = await request<any>(`/shows/${encodeURIComponent(input.showtimeId)}/holds`, {
      method: 'POST',
      signal,
      expect: [409, 400],
      headers,
      body: { seat_ids: targetSeatIds },
    });
    status = res.status;
    data = res.data;
  } catch {
    const res = await request<any>('/holds', {
      method: 'POST',
      signal,
      expect: [409, 400],
      headers,
      body: {
        showtime_id: input.showtimeId,
        seat_labels: input.seatLabels,
        user_ref: input.userRef || 'web-anon',
      },
    });
    status = res.status;
    data = res.data;
  }

  if (status === 409 || status === 400 || (data && data.success === false)) {
    const errObj = data?.error || {};
    return {
      held: false,
      conflict: {
        error: errObj.code || 'SEAT_UNAVAILABLE',
        message: errObj.message || 'One or more selected seats are unavailable',
        conflicting_seats: input.seatLabels || [],
      },
    };
  }

  const payload = data?.data || data || {};
  const bookingId = payload.booking_id || payload.hold_id || payload.id;
  const bookingRef = payload.booking_ref || `bk_${String(bookingId).slice(0, 8)}`;
  const totalAmount = parseFloat(String(payload.total_amount || payload.total_minor || '0'));
  const totalMinor = payload.total_minor || Math.round(totalAmount * 100);
  const expiresAt = payload.hold_until || payload.expires_at || new Date(Date.now() + 600000).toISOString();

  const seatsList = (payload.seats || []).map((s: any, idx: number) => ({
    seat_id: s.seat_id || s.id || `seat-${idx}`,
    label: input.seatLabels?.[idx] || `S${idx + 1}`,
    price_minor: Math.round(parseFloat(String(s.price || '0')) * 100),
  }));

  const hold: Hold = {
    hold_id: bookingId,
    booking_id: bookingId,
    booking_ref: bookingRef,
    showtime_id: input.showtimeId,
    seats: seatsList,
    total_minor: totalMinor,
    currency: 'BDT',
    expires_at: expiresAt,
    hold_ttl_seconds: 300,
  };

  return { held: true, hold };
}

export async function releaseHold(holdId: string, signal?: AbortSignal): Promise<void> {
  try {
    await request<void>(`/bookings/${encodeURIComponent(holdId)}/cancel`, { method: 'POST', signal });
  } catch {
    await request<void>(`/holds/${encodeURIComponent(holdId)}`, { method: 'DELETE', signal }).catch(() => {});
  }
}

/* -- Booking --------------------------------------------------------------- */

export async function createBooking(
  holdId: string,
  phone: string,
  signal?: AbortSignal,
): Promise<Booking> {
  try {
    return await getBooking(holdId, signal);
  } catch {
    const { data } = await request<any>('/bookings', {
      method: 'POST',
      signal,
      body: { hold_id: holdId, phone },
    });
    return data?.data || data;
  }
}

export async function sendOtp(ref: string, phone = '01700000000', signal?: AbortSignal): Promise<void> {
  try {
    await request<any>('/otp/send', {
      method: 'POST',
      signal,
      body: { phone, reference_ref: ref },
    });
  } catch {
    await request<void>(`/bookings/${encodeURIComponent(ref)}/otp/send`, {
      method: 'POST',
      signal,
    });
  }
}

export async function verifyOtp(ref: string, code: string, phone = '01700000000', signal?: AbortSignal): Promise<void> {
  try {
    await request<any>('/otp/verify', {
      method: 'POST',
      signal,
      body: { phone, reference_ref: ref, code },
    });
  } catch {
    await request<void>(`/bookings/${encodeURIComponent(ref)}/otp/verify`, {
      method: 'POST',
      signal,
      body: { code },
    });
  }
}

export interface PayAccepted {
  booking_ref: string;
  payment_status: 'PENDING';
  poll: string;
}

export async function pay(ref: string, signal?: AbortSignal): Promise<PayAccepted> {
  const idempotencyKey = `pay_${ref}_${Date.now()}`;

  try {
    const { data } = await request<any>('/payments', {
      method: 'POST',
      signal,
      headers: { 'Idempotency-Key': idempotencyKey },
      body: { booking_id: ref, idempotency_key: idempotencyKey },
    });

    const payload = data?.data || data;
    return {
      booking_ref: payload.booking_ref || ref,
      payment_status: 'PENDING',
      poll: `/bookings/${ref}`,
    };
  } catch {
    const { data } = await request<PayAccepted>(`/bookings/${encodeURIComponent(ref)}/pay`, {
      method: 'POST',
      signal,
    });
    return data;
  }
}

export async function getBooking(ref: string, signal?: AbortSignal): Promise<Booking> {
  const { data } = await request<any>(`/bookings/${encodeURIComponent(ref)}`, { signal });
  const raw = data?.data || data;

  const rawStatus = (raw.status || 'PENDING').toUpperCase();

  let status: BookingStatus = 'PENDING_PAYMENT';
  if (rawStatus === 'CONFIRMED') status = 'CONFIRMED';
  else if (rawStatus === 'PAYMENT_FAILED') status = 'PAYMENT_FAILED';
  else if (rawStatus === 'EXPIRED') status = 'EXPIRED';
  else if (rawStatus === 'CANCELLED') status = 'CANCELLED';
  else if (rawStatus === 'REFUNDED') status = 'REFUNDED';

  const seatsList = (raw.seats || []).map((s: any) => ({
    seat_id: s.show_seat_id || s.seat_id || s.id,
    label: s.row_number && s.seat_number ? `${s.row_number}${s.seat_number}` : s.label || 'Seat',
    price_minor: Math.round(parseFloat(String(s.price || '0')) * 100),
  }));

  const totalAmount = parseFloat(String(raw.total_amount || raw.total_minor || '0'));
  const totalMinor = raw.total_minor || Math.round(totalAmount * 100);

  return {
    booking_ref: raw.booking_ref || raw.id || ref,
    booking_id: raw.id,
    status,
    payment_status: status === 'CONFIRMED' ? 'SUCCEEDED' : status === 'PAYMENT_FAILED' ? 'FAILED' : 'PENDING',
    showtime_id: raw.show_id || '',
    movie: {
      title: raw.movie_title || raw.movie?.title || 'Cinema Ticket',
      rating: raw.rating || raw.movie?.rating || 'PG-13',
    },
    theatre: {
      name: raw.theatre_name || raw.theatre?.name || 'Cineplex Star Cinema',
      screen: raw.screen_name || raw.theatre?.screen || 'Hall 1',
    },
    starts_at: raw.start_time || raw.starts_at,
    seats: seatsList,
    total_minor: totalMinor,
    currency: 'BDT',
    ticket_qr: status === 'CONFIRMED' ? `TICKET-${raw.booking_ref || ref}` : undefined,
    created_at: raw.created_at,
    server_time: new Date().toISOString(),
  };
}
