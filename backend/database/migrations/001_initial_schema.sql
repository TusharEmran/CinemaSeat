-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Movies
CREATE TABLE IF NOT EXISTS movies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL,
    genre VARCHAR(100) NOT NULL,
    rating VARCHAR(20) DEFAULT 'PG-13',
    poster_url TEXT,
    release_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Theatres
CREATE TABLE IF NOT EXISTS theatres (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Screens
CREATE TABLE IF NOT EXISTS screens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theatre_id UUID NOT NULL REFERENCES theatres(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    total_seats INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seats (Physical permanent seats in a screen)
CREATE TABLE IF NOT EXISTS seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    row_number VARCHAR(10) NOT NULL,
    seat_number INT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_screen_seat UNIQUE (screen_id, row_number, seat_number)
);

-- Shows
CREATE TABLE IF NOT EXISTS shows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ShowSeats (Instance of physical seat state for a show)
CREATE TABLE IF NOT EXISTS show_seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, HELD, BOOKED
    hold_until TIMESTAMPTZ,
    price NUMERIC(10, 2) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_show_seat UNIQUE (show_id, seat_id)
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_ref VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, CONFIRMED, CANCELLED, EXPIRED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BookingSeats
CREATE TABLE IF NOT EXISTS booking_seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    show_seat_id UUID NOT NULL REFERENCES show_seats(id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_booking_show_seat UNIQUE (booking_id, show_seat_id)
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    booking_ref VARCHAR(100) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
    gateway_payment_id VARCHAR(100),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCEEDED, FAILED, REFUNDED
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PaymentEvents (Gateway Webhook Deduplication)
CREATE TABLE IF NOT EXISTS payment_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    booking_ref VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OtpVerifications
CREATE TABLE IF NOT EXISTS otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(50) NOT NULL,
    reference_ref VARCHAR(100) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, VERIFIED, EXPIRED, FAILED
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OutboxEvents (Transactional Outbox Pattern)
CREATE TABLE IF NOT EXISTS outbox_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, PUBLISHED, FAILED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

-- ProcessedEvents (Per-Consumer Idempotency for RabbitMQ Consumers)
CREATE TABLE IF NOT EXISTS processed_events (
    consumer_name VARCHAR(100) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (consumer_name, event_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    user_ref VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL, -- EMAIL, SMS
    recipient VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, SENT, FAILED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NotificationDeliveries
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    attempt INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL,
    response TEXT,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & quick query resolution
CREATE INDEX IF NOT EXISTS idx_screens_theatre ON screens(theatre_id);
CREATE INDEX IF NOT EXISTS idx_seats_screen ON seats(screen_id);
CREATE INDEX IF NOT EXISTS idx_shows_movie ON shows(movie_id);
CREATE INDEX IF NOT EXISTS idx_shows_screen ON shows(screen_id);
CREATE INDEX IF NOT EXISTS idx_shows_start ON shows(start_time);
CREATE INDEX IF NOT EXISTS idx_show_seats_show ON show_seats(show_id);
CREATE INDEX IF NOT EXISTS idx_show_seats_status ON show_seats(status);
CREATE INDEX IF NOT EXISTS idx_show_seats_hold ON show_seats(hold_until) WHERE status = 'HELD';
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_show ON bookings(show_id);
CREATE INDEX IF NOT EXISTS idx_bookings_ref ON bookings(booking_ref);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments(booking_ref);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payment_events_event ON payment_events(event_id);
CREATE INDEX IF NOT EXISTS idx_outbox_events_pending ON outbox_events(status, id) WHERE status = 'PENDING';
