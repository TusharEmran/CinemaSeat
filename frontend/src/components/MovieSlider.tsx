'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import type { Movie } from '../api/types';

/*
 * Animated horizontal movie slider with:
 *   - Auto-scroll that pauses on hover
 *   - Manual prev/next buttons
 *   - Smooth CSS scroll-snap
 *   - Fade-out edges for a polished look
 *   - Responsive card sizing
 */

export function MovieSlider({ movies }: { movies: Movie[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  const scrollBy = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('[data-slide]')?.clientWidth ?? 280;
    const gap = 20;
    const distance = (cardWidth + gap) * (direction === 'right' ? 1 : -1);
    el.scrollBy({ left: distance, behavior: 'smooth' });
  }, []);

  // Auto-scroll every 4 seconds
  useEffect(() => {
    const startAutoScroll = () => {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = setInterval(() => {
        if (isPaused) return;
        const el = scrollRef.current;
        if (!el) return;

        // If near the end, scroll back to start
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 20) {
          el.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollBy('right');
        }
      }, 4000);
    };

    startAutoScroll();
    return () => {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    };
  }, [isPaused, scrollBy]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [updateScrollButtons]);

  if (movies.length === 0) return null;

  return (
    <div
      className="relative group/slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Left fade edge */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-16 sm:w-24 z-10 pointer-events-none transition-opacity duration-300 bg-gradient-to-r from-[var(--color-bg)] to-transparent ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      />

      {/* Right fade edge */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-16 sm:w-24 z-10 pointer-events-none transition-opacity duration-300 bg-gradient-to-l from-[var(--color-bg)] to-transparent ${canScrollRight ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      />

      {/* Prev button */}
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => scrollBy('left')}
        disabled={!canScrollLeft}
        className={`absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-lg ring-1 ring-black/5 transition-all duration-300 cursor-pointer hover:bg-white hover:shadow-xl hover:scale-105 ${canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="text-ink">
          <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Next button */}
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => scrollBy('right')}
        disabled={!canScrollRight}
        className={`absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-lg ring-1 ring-black/5 transition-all duration-300 cursor-pointer hover:bg-white hover:shadow-xl hover:scale-105 ${canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="text-ink">
          <path d="M7 4l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Scrollable track */}
      <div
        ref={scrollRef}
        role="list"
        className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory px-5 sm:px-8 pb-4 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {movies.map((movie) => (
          <SlideCard key={movie.id} movie={movie} />
        ))}
      </div>

      {/* Progress dots */}
      <ScrollDots scrollRef={scrollRef} count={movies.length} />
    </div>
  );
}

/* -- Slide Card ------------------------------------------------------------ */

function SlideCard({ movie }: { movie: Movie }) {
  return (
    <div
      data-slide
      role="listitem"
      className="snap-start shrink-0 w-[200px] sm:w-[230px] lg:w-[260px]"
    >
      <Link
        href={`/showtimes/${encodeURIComponent(movie.id)}`}
        aria-label={`See showtimes for ${movie.title}`}
        className="group block"
      >
        {/* Poster */}
        <div className="relative w-full overflow-hidden rounded-2xl ring-1 ring-black/5 transition-all duration-300 group-hover:ring-accent/30 group-hover:shadow-[0_16px_50px_-12px_rgba(225,29,72,0.15)]">
          {movie.poster_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={movie.poster_url}
                alt={`Poster for ${movie.title}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                style={{ aspectRatio: '2 / 3' }}
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                <span className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  Book tickets
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2.5 6h7m0 0L6.5 3M9.5 6l-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
            </>
          ) : (
            <div
              className="poster-fallback flex items-center justify-center"
              style={{ aspectRatio: '2 / 3' }}
              aria-hidden="true"
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="font-display text-3xl font-bold text-accent/50 tracking-tight">
                  {initials(movie.title)}
                </span>
                <span className="block h-px w-10 bg-accent/20" />
                <span className="text-[10px] uppercase tracking-[0.15em] text-muted/40">CinemaSeat</span>
              </div>
            </div>
          )}
        </div>

        {/* Title & meta below poster */}
        <div className="mt-3 px-0.5">
          <h3 className="font-display text-sm sm:text-base font-semibold text-ink leading-snug line-clamp-1 group-hover:text-accent transition-colors duration-200">
            {movie.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted">
            {movie.rating && <span>{movie.rating}</span>}
            {movie.rating && movie.runtime_minutes && (
              <span className="h-2.5 w-px bg-line" aria-hidden="true" />
            )}
            {movie.runtime_minutes && <span>{formatRuntime(movie.runtime_minutes)}</span>}
          </div>
        </div>
      </Link>
    </div>
  );
}

/* -- Scroll Progress Dots -------------------------------------------------- */

function ScrollDots({
  scrollRef,
  count,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  count: number;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const cardEl = el.querySelector('[data-slide]');
      if (!cardEl) return;
      const cardWidth = cardEl.clientWidth + 20; // card + gap
      const idx = Math.round(el.scrollLeft / cardWidth);
      setActive(Math.min(idx, count - 1));
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollRef, count]);

  // Show at most 7 dots for visual cleanliness
  const dotCount = Math.min(count, 7);

  return (
    <div className="flex items-center justify-center gap-1.5 mt-6" aria-hidden="true">
      {Array.from({ length: dotCount }).map((_, i) => (
        <span
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === active % dotCount
              ? 'w-6 h-2 bg-accent'
              : 'w-2 h-2 bg-ink/10 hover:bg-ink/20'
          }`}
        />
      ))}
    </div>
  );
}

/* -- Helpers --------------------------------------------------------------- */

function initials(title: string): string {
  const words = title
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(the|a|an)$/i.test(w));
  if (words.length === 0) return 'CS';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
