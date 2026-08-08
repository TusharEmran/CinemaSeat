'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { ApiRequestError, getBooking } from '../../../api/client';
import type { Booking, BookingStatus } from '../../../api/types';
import { formatMinor, isTerminal } from '../../../api/types';

/**
 * The callback is 2–15 seconds behind by specification, so poll fast while that
 * is plausible and back off after. We stop at GIVE_UP_MS rather than spinning
 * forever — a poll that never ends is just a spinner that lies more slowly.
 */
const FAST_INTERVAL_MS = 2_000;
const SLOW_INTERVAL_MS = 5_000;
const BACKOFF_AFTER_MS = 30_000;
const GIVE_UP_MS = 120_000;

type Tone = 'pending' | 'good' | 'bad' | 'neutral';

interface StatusCopy {
  tone: Tone;
  headline: string;
  detail: string;
}

const STATUS_COPY: Record<BookingStatus, StatusCopy> = {
  PENDING_PAYMENT: {
    tone: 'pending',
    headline: 'Confirming your payment',
    detail:
      'The payment gateway usually answers within 2–15 seconds. Your seats are not confirmed yet — this page updates itself the moment the gateway responds.',
  },
  CONFIRMED: {
    tone: 'good',
    headline: 'Confirmed — the seats are yours',
    detail: 'Show the code below at the gate. A copy has been sent to your phone.',
  },
  PAYMENT_FAILED: {
    tone: 'bad',
    headline: 'Payment failed',
    detail:
      'The gateway declined the charge, so the booking was not completed and your seats were released back to the map. You have not been charged. Pick your seats again to retry.',
  },
  EXPIRED: {
    tone: 'bad',
    headline: 'The hold expired',
    detail:
      'Seats are held for a short window so they cannot be locked up indefinitely. Payment did not complete inside that window, so these seats went back on sale and may already belong to someone else. You have not been charged.',
  },
  CANCELLED: {
    tone: 'bad',
    headline: 'Booking cancelled',
    detail:
      'This booking was cancelled and the seats were released. If a charge was taken it will be reversed by the gateway.',
  },
  REFUNDED: {
    tone: 'neutral',
    headline: 'Refunded',
    detail:
      'This booking was confirmed and then refunded. The seats are no longer yours and the amount below is on its way back to your account.',
  },
};

const TONE_STYLES: Record<Tone, { text: string; bg: string; ring: string; icon: string }> = {
  pending: { text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200', icon: 'text-amber-500' },
  good: { text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200', icon: 'text-emerald-500' },
  bad: { text: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200', icon: 'text-red-500' },
  neutral: { text: 'text-gray-700', bg: 'bg-gray-50', ring: 'ring-gray-200', icon: 'text-gray-500' },
};

/* -- Polling hook ---------------------------------------------------------- */

function useBookingPoll(ref: string) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [staleError, setStaleError] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [loading, setLoading] = useState(true);

  const startedAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBooking = useCallback(async () => {
    try {
      const data = await getBooking(ref);
      setBooking(data);
      setStaleError(null);
      setLoading(false);

      if (isTerminal(data.status)) {
        if (timer.current) clearInterval(timer.current);
      }
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'Could not load this booking.';
      if (!booking) {
        setFatal(msg);
        setLoading(false);
        if (timer.current) clearInterval(timer.current);
      } else {
        setStaleError(msg);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  const startPolling = useCallback(() => {
    startedAt.current = Date.now();
    setGaveUp(false);
    setFatal(null);
    setStaleError(null);
    setLoading(true);

    fetchBooking();

    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      if (elapsed > GIVE_UP_MS) {
        setGaveUp(true);
        if (timer.current) clearInterval(timer.current);
        return;
      }
      fetchBooking();
    }, Date.now() - startedAt.current > BACKOFF_AFTER_MS ? SLOW_INTERVAL_MS : FAST_INTERVAL_MS);
  }, [fetchBooking]);

  useEffect(() => {
    startPolling();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [startPolling]);

  return { booking, fatal, staleError, gaveUp, loading, retry: startPolling };
}

/* -- Page component -------------------------------------------------------- */

function TicketQr({ value, bookingRef }: { value: string; bookingRef: string }) {
  const isImage = value.startsWith('data:') || value.startsWith('http');

  return (
    <div className="rounded-2xl border border-line bg-white p-6 text-center my-4 shadow-sm">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={`Ticket QR code for booking ${bookingRef}`} className="w-50 h-50 mx-auto [image-rendering:pixelated]" />
      ) : (
        <code className="block break-all text-xs font-mono text-ink">{value}</code>
      )}
      <p className="text-muted text-xs mt-2">Booking reference {bookingRef}</p>
    </div>
  );
}

export default function BookingPage() {
  const params = useParams();
  const ref = params?.bookingId as string;
  const { booking, fatal, staleError, gaveUp, loading, retry } = useBookingPoll(ref);

  if (loading && !booking) {
    return (
      <main className="max-w-2xl mx-auto py-16 px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Loading booking {ref}…</p>
        </div>
      </main>
    );
  }

  if (fatal && !booking) {
    return (
      <main className="max-w-2xl mx-auto py-16 px-5 sm:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="font-display text-2xl font-bold text-ink mb-2">Booking unavailable</h1>
          <p className="mb-4 text-red-700 text-sm">{fatal}</p>
          <div className="flex gap-4 items-center">
            <button type="button" onClick={retry} className="px-4 py-2 rounded-xl border border-line bg-white cursor-pointer hover:bg-accent-soft hover:border-accent/30 text-sm font-medium text-ink transition-colors shadow-sm">
              Try again
            </button>
            <Link href="/" className="text-accent hover:underline text-sm font-medium">
              Back to movies
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!booking) return null;

  const copy = STATUS_COPY[booking.status] ?? {
    tone: 'neutral' as Tone,
    headline: booking.status,
    detail: 'This booking is in a state this page does not recognise.',
  };
  const toneStyle = TONE_STYLES[copy.tone];
  const pending = !isTerminal(booking.status);

  return (
    <main className="max-w-2xl mx-auto py-10 sm:py-16 px-5 sm:px-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-muted mb-8">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="hover:text-accent transition-colors duration-200">
              Films
            </Link>
          </li>
          <li aria-hidden="true">&gt;</li>
          <li className="text-ink font-medium" aria-current="page">
            Booking
          </li>
        </ol>
      </nav>

      {/* Status card */}
      <div className={`rounded-2xl p-6 sm:p-8 ring-1 ${toneStyle.bg} ${toneStyle.ring} mb-6`}>
        <div className="flex items-start gap-4">
          <div className={`mt-1 ${toneStyle.icon}`}>
            {copy.tone === 'good' && <CheckCircleIcon />}
            {copy.tone === 'bad' && <XCircleIcon />}
            {copy.tone === 'pending' && <ClockIcon />}
            {copy.tone === 'neutral' && <InfoIcon />}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted mb-1">Booking {booking.booking_ref}</p>
            <h1 className={`font-display text-2xl font-bold mb-2 ${toneStyle.text}`}>{copy.headline}</h1>
            <p className="text-sm text-gray-700 leading-relaxed">{copy.detail}</p>
          </div>
        </div>
      </div>

      {pending && !gaveUp && (
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm" aria-live="polite">
            Checking with the gateway…
          </p>
        </div>
      )}

      {pending && gaveUp && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 px-5 mb-6" role="status">
          <p className="mb-3 text-sm text-gray-700">
            The gateway has not answered yet. This is still <strong>not</strong> a confirmed
            booking — the payment may yet succeed or fail. Nothing is lost by waiting; check
            again in a moment.
          </p>
          <button type="button" onClick={retry} className="px-4 py-2 rounded-xl border border-line bg-white cursor-pointer hover:bg-accent-soft hover:border-accent/30 text-sm font-medium text-ink transition-colors shadow-sm">
            Check again
          </button>
        </div>
      )}

      {staleError && (
        <p className="text-sm mb-4 text-red-600 px-2" role="status">
          {staleError} Showing the last status we received.
        </p>
      )}

      {booking.status === 'CONFIRMED' && booking.ticket_qr && (
        <TicketQr value={booking.ticket_qr} bookingRef={booking.booking_ref} />
      )}

      {/* Booking details */}
      <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
        <dl>
          {booking.movie && (
            <DetailRow label="Film" value={`${booking.movie.title} (${booking.movie.rating})`} />
          )}
          {booking.theatre && (
            <DetailRow label="Where" value={`${booking.theatre.name} · ${booking.theatre.screen}`} />
          )}
          {booking.starts_at && (
            <DetailRow label="Starts" value={new Date(booking.starts_at).toLocaleString()} />
          )}
          <DetailRow
            label={booking.seats.length === 1 ? 'Seat' : 'Seats'}
            value={booking.seats.map((s) => s.label).join(', ') || '—'}
          />
          <DetailRow label="Total" value={formatMinor(booking.total_minor, booking.currency)} accent />
          <DetailRow label="Payment" value={booking.payment_status} last />
        </dl>
      </div>

      <div className="flex gap-4 items-center mt-8">
        <Link href="/" className="text-accent hover:underline text-sm font-medium">
          ← Back to movies
        </Link>
      </div>
    </main>
  );
}

function DetailRow({ label, value, accent, last }: { label: string; value: string; accent?: boolean; last?: boolean }) {
  return (
    <div className={`flex gap-4 px-5 py-3.5 ${!last ? 'border-b border-line' : ''}`}>
      <dt className="text-muted w-24 shrink-0 text-sm">{label}</dt>
      <dd className={`text-sm ${accent ? 'font-display text-lg font-bold text-ink' : 'text-ink'}`}>{value}</dd>
    </div>
  );
}

/* -- Icons ----------------------------------------------------------------- */

function CheckCircleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
