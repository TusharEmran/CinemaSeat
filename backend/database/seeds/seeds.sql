-- Insert Demo User (Password is 'password123', hashed with bcrypt)
INSERT INTO users (id, name, email, phone, password_hash)
VALUES (
    'a1111111-1111-1111-1111-111111111111',
    'John Doe',
    'john@example.com',
    '01700000000',
    '$2a$10$w1qH2i4cI0O2uAStFwV./u3E4F41A/R73z5.F9oEaO0x4E747F2aK' -- password123
) ON CONFLICT (email) DO NOTHING;

-- Insert Movies
INSERT INTO movies (id, title, description, duration_minutes, genre, rating, poster_url, release_date)
VALUES 
(
    'b1111111-1111-1111-1111-111111111111',
    'Inception: Redux',
    'A thief who steals corporate secrets through dream-sharing technology.',
    148,
    'Sci-Fi',
    'PG-13',
    'https://example.com/inception.jpg',
    '2026-07-15'
),
(
    'b2222222-2222-2222-2222-222222222222',
    'Dune: Part Two',
    'Paul Atreides unites with Chani and the Fremen while seeking revenge.',
    166,
    'Action / Sci-Fi',
    'PG-13',
    'https://example.com/dune2.jpg',
    '2026-03-01'
) ON CONFLICT (id) DO NOTHING;

-- Insert Theatre
INSERT INTO theatres (id, name, location, city)
VALUES (
    'c1111111-1111-1111-1111-111111111111',
    'Cineplex Star Cinema',
    'Bashundhara City Mall, Panthapath',
    'Dhaka'
) ON CONFLICT (id) DO NOTHING;

-- Insert Screen
INSERT INTO screens (id, theatre_id, name, total_seats)
VALUES (
    'd1111111-1111-1111-1111-111111111111',
    'c1111111-1111-1111-1111-111111111111',
    'Hall 1 (IMAX)',
    20
) ON CONFLICT (id) DO NOTHING;

-- Insert 20 Physical Seats for Screen 1 (Rows A and B, seats 1-10) using generate_series
INSERT INTO seats (id, screen_id, row_number, seat_number, type)
SELECT 
    uuid_generate_v4(),
    'd1111111-1111-1111-1111-111111111111',
    CASE WHEN r = 1 THEN 'A' ELSE 'B' END,
    s,
    CASE WHEN r = 2 AND s > 5 THEN 'VIP' ELSE 'STANDARD' END
FROM generate_series(1, 2) AS r
CROSS JOIN generate_series(1, 10) AS s
ON CONFLICT (screen_id, row_number, seat_number) DO NOTHING;

-- Insert Shows for Inception
INSERT INTO shows (id, movie_id, screen_id, start_time, end_time, price)
VALUES (
    'e1111111-1111-1111-1111-111111111111',
    'b1111111-1111-1111-1111-111111111111',
    'd1111111-1111-1111-1111-111111111111',
    NOW() + INTERVAL '2 hours',
    NOW() + INTERVAL '4 hours 30 minutes',
    450.00
) ON CONFLICT (id) DO NOTHING;

-- Populate ShowSeats for Show 1 from physical Seats
INSERT INTO show_seats (id, show_id, seat_id, status, price)
SELECT 
    uuid_generate_v4(),
    'e1111111-1111-1111-1111-111111111111',
    s.id,
    'AVAILABLE',
    450.00
FROM seats s
WHERE s.screen_id = 'd1111111-1111-1111-1111-111111111111'
ON CONFLICT (show_id, seat_id) DO NOTHING;
