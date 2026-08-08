/**
 * OTP send/verify. 10% are delayed or never delivered, by specification.
 *
 * Design consequence: OTP is NOT on the seat-holding critical path. A missing
 * OTP must never cost the user the seat they already hold — that was Zayan's
 * whole night. Resend is allowed (rate-limited, resend_count tracked), and the
 * hold timer stays authoritative and visible.
 */
export {};
