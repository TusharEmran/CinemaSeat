// CinemaSeat Frontend Client Application Logic
const API_BASE = ''; // Same origin proxy or relative path

let state = {
    movies: [],
    shows: [],
    currentShowId: null,
    currentShow: null,
    showSeats: [],
    selectedSeatIds: [],
    activeBooking: null, // holds booking object when seats are held
    holdTimerInterval: null,
    userBookings: [],
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎬 Initializing CinemaSeat Client UI...');
    await checkHealthStatus();
    await loadMovies();
    await loadShows();

    // Auto-refresh seats every 10 seconds if on booking tab
    setInterval(() => {
        if (state.currentShowId && document.getElementById('tab-booking').style.display !== 'none') {
            loadShowSeats(true); // silent refresh
        }
    }, 10000);
});

// Tab Switching Navigation
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

    const activeTab = document.getElementById(`tab-${tabName}`);
    if (activeTab) activeTab.style.display = 'block';

    const activeBtn = Array.from(document.querySelectorAll('.nav-tab')).find(b => b.getAttribute('onclick').includes(tabName));
    if (activeBtn) activeBtn.classList.add('active');

    if (tabName === 'history') {
        loadUserBookings();
    }
}

// Health Status Verification
async function checkHealthStatus() {
    try {
        const res = await fetch('/health');
        if (res.ok) {
            document.getElementById('api-status').innerHTML = '<span class="status-dot"></span> API: Connected';
        }
    } catch (err) {
        document.getElementById('api-status').innerHTML = '<span class="status-dot" style="background:#ef4444;box-shadow:0 0 8px #ef4444;"></span> API: Offline';
    }
}

// Load Movies from API
async function loadMovies() {
    try {
        const res = await fetch('/api/movies');
        const json = await res.json();
        if (json.success && json.data) {
            state.movies = json.data;
            renderMovieGrid(state.movies);
        }
    } catch (err) {
        console.error('Failed to load movies:', err);
    }
}

function renderMovieGrid(movies) {
    const grid = document.getElementById('movie-grid');
    if (!grid) return;

    if (movies.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-muted);">No movies available</div>';
        return;
    }

    grid.innerHTML = movies.map(m => `
        <div class="movie-card" onclick="selectMovieForBooking('${m.id}')">
            <div class="movie-poster-container">
                <img src="${m.poster_url || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop'}" class="movie-poster" alt="${m.title}">
                <div class="movie-rating">${m.rating || 'PG-13'}</div>
            </div>
            <div class="movie-details">
                <div class="movie-title">${m.title}</div>
                <div class="movie-meta">
                    <span>⏱️ ${m.duration_minutes}m</span> • 
                    <span>🎬 ${m.genre}</span>
                </div>
                <button class="btn btn-primary">Book Tickets</button>
            </div>
        </div>
    `).join('');
}

// Load Shows & Populate Select Dropdown
async function loadShows() {
    try {
        const res = await fetch('/api/shows');
        const json = await res.json();
        if (json.success && json.data) {
            state.shows = json.data;
            populateShowDropdown(state.shows);
            if (state.shows.length > 0 && !state.currentShowId) {
                selectShow(state.shows[0].id);
            }
        }
    } catch (err) {
        console.error('Failed to load shows:', err);
    }
}

function populateShowDropdown(shows) {
    const dropdown = document.getElementById('show-select');
    if (!dropdown) return;

    dropdown.innerHTML = shows.map(s => `
        <option value="${s.id}">${s.movie_title} — ${s.screen_name} (৳${s.price})</option>
    `).join('');
}

function selectMovieForBooking(movieId) {
    const matchingShow = state.shows.find(s => s.movie_id === movieId);
    if (matchingShow) {
        selectShow(matchingShow.id);
    }
    switchTab('booking');
}

function onShowSelectChange() {
    const dropdown = document.getElementById('show-select');
    if (dropdown && dropdown.value) {
        selectShow(dropdown.value);
    }
}

async function selectShow(showId) {
    state.currentShowId = showId;
    state.currentShow = state.shows.find(s => s.id === showId);
    state.selectedSeatIds = [];
    state.activeBooking = null;

    if (state.currentShow) {
        document.getElementById('selected-show-title').innerText = `${state.currentShow.movie_title} (${state.currentShow.screen_name})`;
        document.getElementById('selected-show-time').innerText = `${state.currentShow.theatre_name} • ৳${state.currentShow.price}/seat`;
        document.getElementById('price-per-seat').innerText = `৳${state.currentShow.price}`;
    }

    const dropdown = document.getElementById('show-select');
    if (dropdown) dropdown.value = showId;

    updateCheckoutSummary();
    await loadShowSeats();
}

// Load Seats for Current Show
async function loadShowSeats(silent = false) {
    if (!state.currentShowId) return;

    try {
        const res = await fetch(`/api/shows/${state.currentShowId}/seats`);
        const json = await res.json();
        if (json.success && json.data) {
            state.showSeats = json.data;
            renderSeatGrid(state.showSeats);
        }
    } catch (err) {
        console.error('Failed to load show seats:', err);
    }
}

function renderSeatGrid(seats) {
    const grid = document.getElementById('seat-grid');
    if (!grid) return;

    // Group seats by row_number
    const rows = {};
    seats.forEach(s => {
        const row = s.row_number || 'A';
        if (!rows[row]) rows[row] = [];
        rows[row].push(s);
    });

    const sortedRows = Object.keys(rows).sort();

    grid.innerHTML = sortedRows.map(rowKey => `
        <div class="seat-row">
            <div class="row-label">${rowKey}</div>
            ${rows[rowKey].map(s => {
                const isSelected = state.selectedSeatIds.includes(s.seat_id);
                const isVIP = s.seat_type === 'VIP';
                const status = s.effective_status || s.status;

                let statusClass = 'available';
                let disabledAttr = '';

                if (isSelected) {
                    statusClass = 'selected';
                } else if (status === 'HELD') {
                    statusClass = 'held';
                    disabledAttr = 'disabled';
                } else if (status === 'BOOKED') {
                    statusClass = 'booked';
                    disabledAttr = 'disabled';
                }

                if (isVIP && !isSelected && status === 'AVAILABLE') {
                    statusClass += ' vip';
                }

                return `
                    <button class="seat-btn ${statusClass}" ${disabledAttr} onclick="toggleSeatSelection('${s.seat_id}')" title="Seat ${s.row_number}${s.seat_number} (৳${s.price})">
                        ${s.seat_number}
                    </button>
                `;
            }).join('')}
        </div>
    `).join('');
}

// Toggle Seat Selection
function toggleSeatSelection(seatId) {
    if (state.activeBooking) return; // Locks selection once held

    const idx = state.selectedSeatIds.indexOf(seatId);
    if (idx > -1) {
        state.selectedSeatIds.splice(idx, 1);
    } else {
        state.selectedSeatIds.push(seatId);
    }

    renderSeatGrid(state.showSeats);
    updateCheckoutSummary();
}

function updateCheckoutSummary() {
    const badgeContainer = document.getElementById('selected-seats-badges');
    const totalDisplay = document.getElementById('total-amount-display');

    if (state.selectedSeatIds.length === 0) {
        badgeContainer.innerHTML = '<span style="color:var(--text-dim);font-size:0.85rem;">None</span>';
        totalDisplay.innerText = '৳0';
        document.getElementById('btn-hold-seats').disabled = true;
        return;
    }

    document.getElementById('btn-hold-seats').disabled = false;

    const selectedSeats = state.showSeats.filter(s => state.selectedSeatIds.includes(s.seat_id));
    badgeContainer.innerHTML = selectedSeats.map(s => `<span class="seat-badge">${s.row_number}${s.seat_number}</span>`).join('');

    const unitPrice = state.currentShow ? parseFloat(state.currentShow.price) : 450;
    const total = selectedSeats.length * unitPrice;
    totalDisplay.innerText = `৳${total}`;
}

// Hold Selected Seats API Request
async function handleHoldSeats() {
    if (!state.currentShowId || state.selectedSeatIds.length === 0) return;

    try {
        const res = await fetch(`/api/shows/${state.currentShowId}/holds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seat_ids: state.selectedSeatIds }),
        });

        const json = await res.json();
        if (res.ok && json.success) {
            state.activeBooking = json.data;
            alert(`🎉 Seats held successfully! Booking Ref: ${json.data.booking_ref}`);

            document.getElementById('btn-hold-seats').style.display = 'none';
            document.getElementById('btn-checkout-payment').style.display = 'block';

            startHoldTimer(json.data.hold_until, json.data.booking_ref);
            await loadShowSeats();
        } else {
            alert(`❌ Seat Hold Failed: ${json.error ? json.error.message : 'Seats unavailable'}`);
            await loadShowSeats();
        }
    } catch (err) {
        alert(`❌ Network error: ${err.message}`);
    }
}

// 10-Minute Hold Countdown Timer
function startHoldTimer(holdUntilIso, bookingRef) {
    const container = document.getElementById('hold-status-container');
    const timerDisplay = document.getElementById('hold-countdown');
    const refDisplay = document.getElementById('booking-ref-display');

    container.style.display = 'block';
    refDisplay.innerText = `Ref: ${bookingRef}`;

    if (state.holdTimerInterval) clearInterval(state.holdTimerInterval);

    const targetTime = new Date(holdUntilIso).getTime();

    state.holdTimerInterval = setInterval(() => {
        const now = new Date().getTime();
        const diff = targetTime - now;

        if (diff <= 0) {
            clearInterval(state.holdTimerInterval);
            timerDisplay.innerText = 'EXPIRED';
            alert('⏱️ Your seat hold has expired. Please select seats again.');
            resetBookingState();
            return;
        }

        const mins = Math.floor(diff / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        timerDisplay.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }, 1000);
}

function resetBookingState() {
    state.activeBooking = null;
    state.selectedSeatIds = [];
    if (state.holdTimerInterval) clearInterval(state.holdTimerInterval);

    document.getElementById('hold-status-container').style.display = 'none';
    document.getElementById('btn-hold-seats').style.display = 'block';
    document.getElementById('btn-checkout-payment').style.display = 'none';

    updateCheckoutSummary();
    loadShowSeats();
}

// Open Payment Modal
function openPaymentModal() {
    if (!state.activeBooking) return;

    document.getElementById('modal-booking-ref').innerText = state.activeBooking.booking_ref;
    document.getElementById('modal-amount').innerText = `৳${state.activeBooking.total_amount}`;
    document.getElementById('idempotency-key-input').value = `idemp_${Date.now()}`;

    document.getElementById('payment-modal').classList.add('active');
}

function closePaymentModal() {
    document.getElementById('payment-modal').classList.remove('active');
}

// Execute Charge Request
async function executePaymentCharge() {
    if (!state.activeBooking) return;

    const idempotencyKey = document.getElementById('idempotency-key-input').value;
    const behavior = document.getElementById('payment-behavior-select').value;

    const headers = {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
    };

    // Attach mock headers if specified
    if (behavior === 'success') {
        headers['X-Mock-Mode'] = 'deterministic';
        headers['X-Mock-Force'] = 'success';
    } else if (behavior === 'fail') {
        headers['X-Mock-Mode'] = 'deterministic';
        headers['X-Mock-Force'] = 'fail';
    } else if (behavior === 'duplicate') {
        headers['X-Mock-Mode'] = 'deterministic';
        headers['X-Mock-Force'] = 'duplicate';
    } else if (behavior === 'race') {
        headers['X-Mock-Mode'] = 'deterministic';
        headers['X-Mock-Force'] = 'race';
    }

    try {
        const res = await fetch('/api/payments', {
            method: 'POST',
            headers,
            body: JSON.stringify({ booking_id: state.activeBooking.booking_id }),
        });

        const json = await res.json();
        closePaymentModal();

        if (res.status === 202 && json.success) {
            alert('💳 Payment charge initiated! Waiting for gateway callback confirmation...');
            
            // Poll booking status after 2 seconds
            setTimeout(async () => {
                await checkBookingConfirmation(state.activeBooking.booking_id);
            }, 2500);
        } else {
            alert(`❌ Payment failed: ${json.error ? json.error.message : 'Charge rejected'}`);
        }
    } catch (err) {
        alert(`❌ Network error: ${err.message}`);
    }
}

async function checkBookingConfirmation(bookingId) {
    try {
        const res = await fetch(`/api/bookings/${bookingId}`);
        const json = await res.json();

        if (json.success && json.data) {
            const booking = json.data;
            if (booking.status === 'CONFIRMED') {
                openTicketModal(booking);
                resetBookingState();
            } else if (booking.status === 'CANCELLED') {
                alert('⚠️ Payment failed or was declined by gateway. Seats have been released.');
                resetBookingState();
            } else {
                alert(`Payment status: ${booking.status}. Gateway callback will process shortly.`);
            }
        }
    } catch (err) {
        console.error('Error checking booking status:', err);
    }
}

// Ticket Pass Confirmation Modal
function openTicketModal(booking) {
    document.getElementById('ticket-movie-title').innerText = booking.movie_title || 'Movie Ticket';
    document.getElementById('ticket-show-details').innerText = `${booking.theatre_name} • ${new Date(booking.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    document.getElementById('ticket-ref').innerText = booking.booking_ref;

    const seatNames = booking.seats ? booking.seats.map(s => `${s.row_number}${s.seat_number}`).join(', ') : 'Selected Seats';
    document.getElementById('ticket-seats').innerText = seatNames;

    // Generate QR Code
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    if (typeof qrcode !== 'undefined') {
        const qr = qrcode(0, 'M');
        qr.addData(`CS-PASS-${booking.booking_ref}`);
        qr.make();
        qrContainer.innerHTML = qr.createImgTag(4);
    }

    document.getElementById('ticket-modal').classList.add('active');
}

function closeTicketModal() {
    document.getElementById('ticket-modal').classList.remove('active');
}

// Load User Bookings History
async function loadUserBookings() {
    const container = document.getElementById('history-container');
    if (!container) return;

    container.innerHTML = '<div style="color:var(--text-muted);">Loading bookings history...</div>';

    try {
        const demoUserId = 'a1111111-1111-1111-1111-111111111111';
        const res = await fetch(`/api/users/${demoUserId}/bookings`);
        const json = await res.json();

        if (json.success && json.data && json.data.length > 0) {
            container.innerHTML = json.data.map(b => {
                let badgeColor = '#f59e0b';
                if (b.status === 'CONFIRMED') badgeColor = '#10b981';
                if (b.status === 'CANCELLED' || b.status === 'EXPIRED') badgeColor = '#ef4444';

                return `
                    <div class="movie-card" style="padding:1.25rem; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:700; font-size:1.1rem;">${b.movie_title || 'Cinema Ticket'}</div>
                            <div style="font-size:0.85rem; color:var(--text-muted);">Ref: ${b.booking_ref} • Total: ৳${b.total_amount}</div>
                            <div style="font-size:0.75rem; color:var(--text-dim); margin-top:0.2rem;">Created: ${new Date(b.created_at).toLocaleString()}</div>
                        </div>
                        <div style="text-align:right;">
                            <span style="display:inline-block; padding:0.35rem 0.8rem; border-radius:20px; font-weight:700; font-size:0.8rem; background:rgba(255,255,255,0.05); color:${badgeColor}; border:1px solid ${badgeColor};">
                                ${b.status}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<div style="color:var(--text-muted);">No bookings found</div>';
        }
    } catch (err) {
        container.innerHTML = `<div style="color:#ef4444;">Error loading history: ${err.message}</div>`;
    }
}

// OTP Handlers
async function handleSendOtp() {
    const phone = document.getElementById('otp-phone').value;
    if (!phone) return alert('Enter phone number');

    try {
        const res = await fetch('/api/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
            alert(`📲 OTP sent to ${phone}! Ref: ${json.data.reference_ref}`);
            document.getElementById('otp-ref-input').value = json.data.reference_ref;
            document.getElementById('otp-verify-section').style.display = 'block';
        } else {
            alert(`❌ OTP Send Failed: ${json.error ? json.error.message : 'Error'}`);
        }
    } catch (err) {
        alert(`❌ Network error: ${err.message}`);
    }
}

async function handleVerifyOtp() {
    const phone = document.getElementById('otp-phone').value;
    const ref = document.getElementById('otp-ref-input').value;
    const code = document.getElementById('otp-code-input').value;

    try {
        const res = await fetch('/api/otp/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, reference_ref: ref, code }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
            alert('✅ OTP verified successfully!');
        } else {
            alert(`❌ Verification Failed: ${json.error ? json.error.message : 'Invalid code'}`);
        }
    } catch (err) {
        alert(`❌ Network error: ${err.message}`);
    }
}
