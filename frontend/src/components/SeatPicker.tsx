'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiRequestError, getSeatMap, holdSeats } from '../api/client';
import type { ApiError, Hold, Seat, SeatMap } from '../api/types';
import { formatMinor } from '../api/types';
import { prefixHref } from '../lib/basePath';

/*
 * Interactive seat picker — white theme edition.
 *
 * The interesting case is the 409 on hold: somebody else won the seat. The
 * UI says so plainly, refreshes the map, and lets the user pick again.
 *
 * The seat map is polled every few seconds while the picker is mounted.
 *
 * All times anchored to the server_time the seat map returned, not to the
 * browser clock.
 */

const POLL_MS = 3_000;
const MAX_SELECTED = 8;

type Conflict = { seats: string[]; message: string };

interface PickerState {
  /** Labels the user has selected this session, regardless of server state. */
  selected: Set<string>;
  seatMap: SeatMap | null;
  /** Skew between server_time and Date.now() at the last fetch, in ms. */
  clockSkewMs: number;
  loading: boolean;
  error: string | null;
  /** Last 409 the user has not yet dismissed. */
  conflict: Conflict | null;
  /** Hold-in-flight, so we can disable the button while the request is out. */
  holding: boolean;
}

export function SeatPicker({ initialSeatMap }: { initialSeatMap: SeatMap }) {
  const router = useRouter();
  const [state, setState] = useState<PickerState>({
    selected: new Set(),
    seatMap: initialSeatMap,
    clockSkewMs: 0,
    loading: false,
    error: null,
    conflict: null,
    holding: false,
  });

  const inflight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!state.seatMap) return;

    inflight.current?.abort();
    const ac = new AbortController();
    inflight.current = ac;

    try {
      const fresh = await getSeatMap(state.seatMap.showtime_id, ac.signal);
      setState((prev) => {
        if (!prev.seatMap) return prev;
        const skew = new Date(fresh.server_time).getTime() - Date.now();

        const stillSelectable = new Set<string>();
        for (const label of prev.selected) {
          const seat = findSeat(fresh, label);
          if (seat && seat.status === 'AVAILABLE') stillSelectable.add(label);
        }

        return {
          ...prev,
          seatMap: fresh,
          clockSkewMs: skew,
          selected: stillSelectable,
          loading: false,
        };
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof ApiRequestError ? err.message : 'Could not refresh the seat map.',
      }));
    }
  }, [state.seatMap]);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    return () => inflight.current?.abort();
  }, []);

  const toggle = useCallback((label: string) => {
    setState((prev) => {
      if (!prev.seatMap) return prev;
      const seat = findSeat(prev.seatMap, label);
      if (!seat || seat.status !== 'AVAILABLE') return prev;

      const next = new Set(prev.selected);
      if (next.has(label)) {
        next.delete(label);
      } else {
        if (next.size >= MAX_SELECTED) return prev;
        next.add(label);
      }
      return { ...prev, selected: next, conflict: null };
    });
  }, []);

  const hold = useCallback(async () => {
    if (!state.seatMap || state.selected.size === 0 || state.holding) return;

    setState((prev) => ({ ...prev, holding: true, error: null, conflict: null }));

    const result = await holdSeats({
      showtimeId: state.seatMap.showtime_id,
      seatLabels: Array.from(state.selected),
      userRef: 'web-anon',
    });

    if (result.held === true) {
      router.push(prefixHref(`/checkout/${result.hold.hold_id}`));
      return;
    }

    const conflictErr = (result as { held: false; conflict: ApiError }).conflict;
    const conflictingSeats: string[] = conflictErr.conflicting_seats ?? [];
    const conflicting = new Set<string>(conflictingSeats);
    setState((prev) => {
      const remaining = new Set<string>();
      for (const label of prev.selected) {
        if (!conflicting.has(label)) remaining.add(label);
      }
      return {
        ...prev,
        holding: false,
        conflict: {
          seats: Array.from(conflicting),
          message: conflictErr.message,
        },
        selected: remaining,
      };
    });
    refresh();
  }, [state.seatMap, state.selected, state.holding, refresh, router]);

  const clearConflict = useCallback(() => {
    setState((prev) => ({ ...prev, conflict: null }));
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
      <SeatCanvas seatMap={state.seatMap} selected={state.selected} onToggle={toggle} />

      <aside className="lg:sticky lg:top-20 self-start">
        <Summary
          seatMap={state.seatMap}
          selected={state.selected}
          holding={state.holding}
          onHold={hold}
          onClearConflict={clearConflict}
          conflict={state.conflict}
          error={state.error}
          clockSkewMs={state.clockSkewMs}
        />
      </aside>
    </div>
  );
}

/* -- Canvas ---------------------------------------------------------------- */

function SeatCanvas({
  seatMap,
  selected,
  onToggle,
}: {
  seatMap: SeatMap | null;
  selected: Set<string>;
  onToggle: (label: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 sm:p-8 shadow-sm">
      <ScreenBanner />

      <div className="mt-10 flex flex-col items-center gap-2">
        {seatMap?.rows.map((row) => (
          <Row key={row.row} row={row} selected={selected} onToggle={onToggle} />
        ))}
      </div>

      <Legend />
    </div>
  );
}

function ScreenBanner() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="h-1.5 w-3/4 max-w-md rounded-full bg-gradient-to-r from-transparent via-accent/40 to-transparent"
        aria-hidden="true"
      />
      <span className="text-xs uppercase tracking-[0.3em] text-muted">Screen</span>
    </div>
  );
}

function Row({
  row,
  selected,
  onToggle,
}: {
  row: { row: string; seats: Seat[] };
  selected: Set<string>;
  onToggle: (label: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="w-5 text-xs uppercase text-muted text-right font-medium">{row.row}</span>
      <div className="flex gap-1.5">
        {row.seats.map((seat, i) => (
          <SeatButton
            key={seat.seat_id}
            seat={seat}
            selected={selected.has(seat.label)}
            onToggle={onToggle}
            /** Insert an aisle gap after seats 4 and 10 to mimic a real layout. */
            aisleAfter={i === 3 || i === 9}
          />
        ))}
      </div>
      <span className="w-5 text-xs uppercase text-muted font-medium">{row.row}</span>
    </div>
  );
}

function SeatButton({
  seat,
  selected,
  onToggle,
  aisleAfter,
}: {
  seat: Seat;
  selected: boolean;
  onToggle: (label: string) => void;
  aisleAfter: boolean;
}) {
  const interactive = seat.status === 'AVAILABLE';
  const aria = seatAriaLabel(seat);
  const cls = seatClasses(seat, selected);

  return (
    <>
      <button
        type="button"
        aria-pressed={selected}
        aria-label={aria}
        disabled={!interactive}
        onClick={() => interactive && onToggle(seat.label)}
        className={`${cls} ${interactive ? 'cursor-pointer' : 'cursor-not-allowed'} ${aisleAfter ? 'mr-3 sm:mr-5' : ''}`}
        title={aria}
      >
        {seat.label}
      </button>
    </>
  );
}

function Legend() {
  const items: { label: string; className: string }[] = [
    { label: 'Available', className: 'bg-white border-line' },
    { label: 'Selected', className: 'bg-accent border-accent text-white' },
    { label: 'Held', className: 'bg-amber-50 border-amber-300 text-amber-700' },
    { label: 'Booked', className: 'bg-gray-100 border-gray-200 text-gray-400 line-through' },
  ];

  return (
    <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <span className={`inline-block h-4 w-4 rounded-sm border ${it.className}`} aria-hidden="true" />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/* -- Summary panel --------------------------------------------------------- */

function Summary({
  seatMap,
  selected,
  holding,
  onHold,
  onClearConflict,
  conflict,
  error,
  clockSkewMs,
}: {
  seatMap: SeatMap | null;
  selected: Set<string>;
  holding: boolean;
  onHold: () => void;
  onClearConflict: () => void;
  conflict: Conflict | null;
  error: string | null;
  clockSkewMs: number;
}) {
  const breakdown = useMemo(() => breakdownFor(seatMap, selected), [seatMap, selected]);
  const empty = selected.size === 0;

  return (
    <div className="rounded-2xl border border-line bg-white p-5 sm:p-6 flex flex-col gap-5 shadow-sm">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.25em] text-accent font-semibold">Your selection</p>
        <h2 className="font-display text-xl text-ink font-semibold">
          {empty ? 'No seats yet' : `${selected.size} seat${selected.size === 1 ? '' : 's'}`}
        </h2>
      </header>

      {conflict && (
        <ConflictBanner conflict={conflict} onDismiss={onClearConflict} />
      )}

      {empty ? (
        <p className="text-sm text-muted leading-relaxed">
          Tap any open seat on the map to add it here. You can pick up to {MAX_SELECTED} at once.
        </p>
      ) : (
        <SelectedList breakdown={breakdown} />
      )}

      <Totals breakdown={breakdown} />

      <button
        type="button"
        onClick={onHold}
        disabled={empty || holding}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-hi disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {holding ? 'Holding seats…' : 'Hold seats and continue'}
      </button>

      <p className="text-xs text-muted leading-relaxed">
        We&apos;ll hold these seats for a few minutes while you check out. They&apos;re not charged
        until you confirm payment.
      </p>

      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      {Math.abs(clockSkewMs) > 30_000 && (
        <p className="text-xs text-muted">
          Local clock differs from the cinema by {Math.round(clockSkewMs / 1000)}s -- timeouts use
          the cinema clock.
        </p>
      )}
    </div>
  );
}

function SelectedList({ breakdown }: { breakdown: TierBreakdown[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-bg">
      {breakdown.map((t) => (
        <li key={t.tier} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <div className="flex flex-col">
            <span className="text-ink font-medium">{t.labels.join(', ')}</span>
            <span className="text-xs text-muted">{t.tier}</span>
          </div>
          <span className="text-ink tabular-nums font-medium">{formatMinor(t.subtotalMinor)}</span>
        </li>
      ))}
    </ul>
  );
}

function Totals({ breakdown }: { breakdown: TierBreakdown[] }) {
  const total = breakdown.reduce((acc, t) => acc + t.subtotalMinor, 0);
  return (
    <div className="flex items-baseline justify-between border-t border-line pt-4">
      <span className="text-sm text-muted">Total</span>
      <span className="font-display text-2xl text-ink tabular-nums font-bold">
        {formatMinor(total)}
      </span>
    </div>
  );
}

function ConflictBanner({
  conflict,
  onDismiss,
}: {
  conflict: Conflict;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex flex-col gap-2"
    >
      <p className="text-sm text-amber-800">
        <strong className="font-semibold">Somebody else got there first.</strong>{' '}
        {conflict.seats.length > 0
          ? `${conflict.seats.join(', ')} just sold. `
          : 'One of your seats just sold. '}
        We&apos;ve refreshed the map — pick again.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="self-start text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900 cursor-pointer"
      >
        Dismiss
      </button>
    </div>
  );
}

/* -- Pure helpers ---------------------------------------------------------- */

interface TierBreakdown {
  tier: Seat['tier'];
  labels: string[];
  subtotalMinor: number;
}

function breakdownFor(seatMap: SeatMap | null, selected: Set<string>): TierBreakdown[] {
  if (!seatMap) return [];
  const byTier = new Map<Seat['tier'], { labels: string[]; subtotalMinor: number }>();
  const order: Seat['tier'][] = ['PREMIUM', 'STANDARD', 'RECLINER'];

  for (const row of seatMap.rows) {
    for (const seat of row.seats) {
      if (!selected.has(seat.label)) continue;
      const slot = byTier.get(seat.tier) ?? { labels: [], subtotalMinor: 0 };
      slot.labels.push(seat.label);
      slot.subtotalMinor += seat.price_minor;
      byTier.set(seat.tier, slot);
    }
  }

  return order
    .filter((tier) => byTier.has(tier))
    .map((tier) => ({ tier, ...byTier.get(tier)! }));
}

function findSeat(seatMap: SeatMap, label: string): Seat | null {
  for (const row of seatMap.rows) {
    for (const seat of row.seats) {
      if (seat.label === label) return seat;
    }
  }
  return null;
}

function seatClasses(seat: Seat, selected: boolean): string {
  const base =
    'h-7 w-7 sm:h-8 sm:w-8 rounded-md border text-[10px] font-medium tabular-nums flex items-center justify-center transition-all duration-150';

  if (selected) {
    return `${base} bg-accent border-accent text-white shadow-[0_0_0_2px_rgba(225,29,72,0.2)]`;
  }

  if (seat.status === 'BOOKED') {
    return `${base} bg-gray-100 border-gray-200 text-gray-400 line-through`;
  }

  if (seat.status === 'HELD') {
    return `${base} bg-amber-50 border-amber-300 text-amber-700`;
  }

  // AVAILABLE -- tier gets a subtle hue so the price zones are visible.
  const tierAccent =
    seat.tier === 'PREMIUM'
      ? 'border-accent/30 hover:border-accent/60 hover:bg-accent-soft'
      : seat.tier === 'RECLINER'
        ? 'border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50'
        : 'border-line hover:border-gray-300 hover:bg-gray-50';

  return `${base} bg-white ${tierAccent} text-ink`;
}

function seatAriaLabel(seat: Seat): string {
  if (seat.status === 'BOOKED') return `Seat ${seat.label} is taken`;
  if (seat.status === 'HELD') return `Seat ${seat.label} is held by someone else`;
  return `Seat ${seat.label}, ${seat.tier.toLowerCase()}, ${formatMinor(seat.price_minor)}`;
}

/* Avoid unused-import lints for Hold type — kept exported via mock fixtures. */
export type { Hold };