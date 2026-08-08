'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ApiRequestError, createBooking, pay, sendOtp, verifyOtp } from '../../../api/client';
import { formatMinor } from '../../../api/types';

interface PageProps {
  params: Promise<{ holdId: string }>;
}

type Step = 'PHONE' | 'OTP' | 'PAYMENT';

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';
const INITIAL_HOLD_TTL = 300; // 5 minutes in seconds

export default function CheckoutPage({ params }: PageProps) {
  const { holdId } = use(params);
  const router = useRouter();

  const [step, setStep] = useState<Step>('PHONE');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [bookingRef, setBookingRef] = useState<string | null>(null);
  
  const [ttl, setTtl] = useState<number>(INITIAL_HOLD_TTL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Hold expiration countdown
  useEffect(() => {
    if (ttl <= 0) return;
    const timer = setInterval(() => {
      setTtl((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [ttl]);

  // Resend OTP cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Submit Phone Number
  const handlePhoneSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (USE_MOCKS) {
        const mockRef = `bk-${holdId.slice(0, 8)}`;
        setBookingRef(mockRef);
        setStep('OTP');
        setResendCooldown(30);
      } else {
        const booking = await createBooking(holdId, phone.trim());
        setBookingRef(booking.booking_ref);
        await sendOtp(booking.booking_ref);
        setStep('OTP');
        setResendCooldown(30);
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.code === 'HOLD_EXPIRED' || err.status === 410) {
          setTtl(0);
          setError('This seat hold has expired. Please select your seats again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to initiate booking. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [holdId, phone]);

  // Step 2: Submit OTP
  const handleOtpSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length < 4) {
      setError('Please enter the verification code sent to your phone.');
      return;
    }
    if (!bookingRef) return;

    setLoading(true);
    setError(null);

    try {
      if (USE_MOCKS) {
        setStep('PAYMENT');
      } else {
        await verifyOtp(bookingRef, otpCode.trim());
        setStep('PAYMENT');
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [bookingRef, otpCode]);

  // Resend OTP handler
  const handleResendOtp = useCallback(async () => {
    if (resendCooldown > 0 || !bookingRef) return;
    setError(null);
    setResendCooldown(30);

    try {
      if (!USE_MOCKS) {
        await sendOtp(bookingRef);
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not resend OTP. Please try again.');
    }
  }, [bookingRef, resendCooldown]);

  // Step 3: Pay & Confirm
  const handlePay = useCallback(async () => {
    if (!bookingRef) return;

    setLoading(true);
    setError(null);

    try {
      if (USE_MOCKS) {
        router.push(`/booking/${bookingRef}`);
      } else {
        await pay(bookingRef);
        router.push(`/booking/${bookingRef}`);
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Payment request failed. Please try again.');
      setLoading(false);
    }
  }, [bookingRef, router]);

  const isExpired = ttl <= 0;

  if (isExpired) {
    return (
      <div className="mx-auto max-w-xl px-5 sm:px-8 py-24 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-danger">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-xs uppercase tracking-[0.25em] text-danger font-semibold">Hold Expired</p>
        <h1 className="font-display text-3xl text-ink mt-3 mb-3 font-bold">Your seat hold has timed out</h1>
        <p className="text-muted mb-6">
          Seats are held for 5 minutes during checkout to ensure availability for all guests.
          Please select your seats again to continue.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-medium text-ink hover:border-accent/30 hover:bg-accent-soft transition-colors duration-200 cursor-pointer shadow-sm"
        >
          Back to films
        </Link>
      </div>
    );
  }

  const minutes = Math.floor(ttl / 60);
  const seconds = String(ttl % 60).padStart(2, '0');

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-14">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-muted mb-6">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="hover:text-accent transition-colors duration-200">
              Films
            </Link>
          </li>
          <li aria-hidden="true">&gt;</li>
          <li className="text-ink font-medium" aria-current="page">
            Checkout
          </li>
        </ol>
      </nav>

      {/* Header & Hold Countdown */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-accent font-semibold">Checkout</p>
          <h1 className="font-display text-3xl text-ink mt-1 font-bold">Complete your reservation</h1>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
          <div className="text-xs">
            <span className="text-amber-700 block">Seats held for</span>
            <span className="font-mono text-base font-bold text-amber-800">
              {minutes}:{seconds}
            </span>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="mb-10 grid grid-cols-3 gap-2 text-center">
        <div
          className={`rounded-xl border p-3 text-xs font-semibold transition-colors ${
            step === 'PHONE'
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line bg-white text-muted'
          }`}
        >
          1. Phone Number
        </div>
        <div
          className={`rounded-xl border p-3 text-xs font-semibold transition-colors ${
            step === 'OTP'
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line bg-white text-muted'
          }`}
        >
          2. Verification
        </div>
        <div
          className={`rounded-xl border p-3 text-xs font-semibold transition-colors ${
            step === 'PAYMENT'
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line bg-white text-muted'
          }`}
        >
          3. Confirm & Pay
        </div>
      </div>

      {/* Card Content */}
      <div className="rounded-2xl border border-line bg-white p-6 sm:p-8 shadow-sm">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-danger" role="alert">
            {error}
          </div>
        )}

        {/* Step 1: Phone */}
        {step === 'PHONE' && (
          <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-xl text-ink font-semibold">Contact Details</h2>
              <p className="text-sm text-muted mt-1">
                We will send your ticket confirmation and SMS verification code to this phone number.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="phone" className="text-xs uppercase tracking-wider text-muted font-medium">
                Mobile Number
              </label>
              <input
                id="phone"
                type="tel"
                required
                placeholder="e.g. 01712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-ink placeholder:text-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hi transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Creating booking…' : 'Continue to verification'}
            </button>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === 'OTP' && (
          <form onSubmit={handleOtpSubmit} className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-xl text-ink font-semibold">Verify your Phone</h2>
              <p className="text-sm text-muted mt-1">
                Enter the verification code sent to <strong className="text-ink">{phone}</strong>.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="otp" className="text-xs uppercase tracking-wider text-muted font-medium">
                Verification Code (OTP)
              </label>
              <input
                id="otp"
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full rounded-xl border border-line bg-bg px-4 py-3 font-mono text-center text-lg tracking-widest text-ink placeholder:text-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Didn&apos;t get the code?</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0}
                className="text-accent hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer font-medium"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hi transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Verifying…' : 'Verify & Continue'}
            </button>
          </form>
        )}

        {/* Step 3: Payment */}
        {step === 'PAYMENT' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-xl text-ink font-semibold">Payment Confirmation</h2>
              <p className="text-sm text-muted mt-1">
                Review your details before confirming your ticket booking.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-bg p-4 flex flex-col gap-3 text-sm">
              <div className="flex justify-between border-b border-line pb-2">
                <span className="text-muted">Hold ID</span>
                <span className="font-mono text-ink">{holdId.slice(0, 16)}…</span>
              </div>
              <div className="flex justify-between border-b border-line pb-2">
                <span className="text-muted">Phone</span>
                <span className="text-ink">{phone}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-muted">Booking Reference</span>
                <span className="font-mono text-accent font-semibold">{bookingRef}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePay}
              disabled={loading}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hi transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Processing payment…' : 'Confirm & Pay Now'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
