const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const otpRoutes = require('./routes/otpRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();

app.use(helmet({
    contentSecurityPolicy: false, // Allow CDNs & inline scripts for demo UI
}));
app.use(cors());

// Serve static frontend from public directory
const publicPath = path.join(__dirname, '../public');
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
}

// Capture raw body for HMAC verification
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint (Returns 200 OK independently)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        service: 'cinemaseat-api',
        timestamp: new Date().toISOString(),
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', bookingRoutes);
app.use('/api', paymentRoutes);
app.use('/api', otpRoutes);
app.use('/', webhookRoutes); // handles /webhooks/payment & /webhooks/otp

// Fallback to public index.html for SPA navigation
app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/webhooks')) {
        return next();
    }
    const indexPath = path.join(__dirname, '../public/index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    next();
});

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
