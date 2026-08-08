# Frontend

Minimal on purpose. The brief says a polished UI earns no extra marks, so this exists to
demonstrate the path and nothing more:

```
browse movies → pick showtime → seat map → hold → OTP → pay → confirmed ticket
```

## The five screens

| Route | File | Job |
| --- | --- | --- |
| `/` | `pages/MoviesPage.tsx` | List movies. |
| `/movies/:id` | `pages/ShowtimesPage.tsx` | Showtimes for a movie. |
| `/showtimes/:id` | `pages/SeatMapPage.tsx` | Live seat map, select seats, hold. |
| `/checkout/:holdId` | `pages/CheckoutPage.tsx` | Hold countdown, OTP, pay. |
| `/bookings/:ref` | `pages/BookingPage.tsx` | Poll status, show the ticket QR. |

## The two things the UI must get right

**The hold countdown is honest.** It counts down from the `expires_at` the server returned,
corrected against `server_time`, not against the browser clock. When it hits zero the UI says
the seat is gone and stops pretending otherwise.

**Payment is not instant, and the UI says so.** `/pay` returns `202`, not a result — the
callback is 2–15 seconds behind by specification. `CheckoutPage` shows an explicit
"confirming your payment" state and polls `GET /api/bookings/:ref` until it reaches a terminal
status. It never claims a booking is confirmed before the server says it is. That is precisely
the bug in Zayan's night: the app said the seat was his, and a refresh showed it gone.
