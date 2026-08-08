# Frontend Architecture

The frontend is intentionally designed as a minimal, highly functional Single Page Application (SPA). The primary objective is to demonstrate the resilience and end-to-end functionality of the booking and payment lifecycle without over-investing in complex styling elements.

**Core User Journey:**
`Browse Movies → Select Showtime → View Live Seat Map → Hold Seat(s) → Verify OTP → Process Payment → View Confirmed Ticket`

## Routing Structure

| Route | Component | Purpose |
| --- | --- | --- |
| `/` | `pages/MoviesPage.tsx` | Displays the available movie catalog. |
| `/movies/:id` | `pages/ShowtimesPage.tsx` | Lists available showtimes for a selected movie. |
| `/showtimes/:id` | `pages/SeatMapPage.tsx` | Renders the live seat map, manages seat selection, and initiates holds. |
| `/checkout/:holdId` | `pages/CheckoutPage.tsx` | Displays the active hold countdown, handles OTP verification, and initiates the payment. |
| `/bookings/:ref` | `pages/BookingPage.tsx` | Polls the backend for terminal booking status and generates the final ticket QR code. |

## Critical UI/UX Engineering Decisions

The frontend implements two key resilience strategies to ensure a consistent user experience during high-concurrency traffic drops:

1. **Authoritative Hold Countdowns** 
   The hold countdown timer is strictly synchronized against the `server_time` and `expires_at` timestamps provided by the backend API. It does not rely on the local browser clock, preventing timezone mismatches or client-side manipulation. When the server-defined TTL reaches zero, the UI immediately invalidates the session and marks the seat as unavailable.

2. **Asynchronous Payment State Management** 
   Because the external payment gateway is inherently asynchronous (and deliberately delayed by 2–15 seconds), the frontend expects a `202 Accepted` response from the `/pay` endpoint rather than immediate confirmation. The `CheckoutPage` intelligently transitions into an explicit "confirming your payment" polling state. It repeatedly queries `GET /api/bookings/:ref` until a terminal status (`CONFIRMED` or `PAYMENT_FAILED`) is reached. This architectural choice prevents "phantom bookings" (e.g., the UI claiming a seat is booked before the database confirms it).
