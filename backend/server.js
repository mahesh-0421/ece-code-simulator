'use strict';

const express = require('express');
const path = require('path');
const { runCode, getEngineStatus } = require('./simulator');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parser
app.use(express.json({ limit: '500kb' }));

// CORS middleware
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

// Simple in-memory sliding window rate limiter (max 40 requests per minute per IP)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 40;

// Clean up stale rate limiter entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitMap.entries()) {
        if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
            rateLimitMap.delete(ip);
        }
    }
}, 5 * 60 * 1000);

function rateLimiter(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now - record.startTime > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.set(ip, { count: 1, startTime: now });
        return next();
    }

    record.count++;
    if (record.count > MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({
            success: false,
            error: 'Too many requests. Please wait a minute before running more simulations.',
            output: '',
            waveform: null,
            plots: []
        });
    }

    next();
}

// Serve frontend static assets
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR, {
    maxAge: '1h',
    etag: true
}));

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    const engines = getEngineStatus();
    res.json({
        success: true,
        status: 'healthy',
        message: 'ECE Code Simulator service is operational.',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        simulators: {
            verilog: engines.verilog.available ? engines.verilog.version : 'Unavailable',
            matlab: engines.matlab.available ? engines.matlab.version : 'Unavailable'
        },
        engineDetails: engines
    });
});

// Engine status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        engines: getEngineStatus()
    });
});

// Simulation endpoint
app.post('/run', rateLimiter, async (req, res) => {
    try {
        const { language, code, mode = 'both' } = req.body || {};

        if (!language || typeof language !== 'string') {
            return res.status(400).json({
                success: false,
                output: '',
                error: 'Simulation language is required (e.g., "verilog" or "matlab").',
                waveform: null,
                plots: [],
                circuitDiagram: null
            });
        }

        if (!code || typeof code !== 'string' || !code.trim()) {
            return res.status(400).json({
                success: false,
                output: '',
                error: 'Source code cannot be empty. Please enter code to simulate.',
                waveform: null,
                plots: [],
                circuitDiagram: null
            });
        }

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local';
        console.log(`[SIMULATION] [${new Date().toISOString()}] IP: ${ip} | Lang: ${language} | Length: ${code.length} chars`);

        const result = await runCode(language, code, mode);

        console.log(`[SIMULATION COMPLETE] Status: ${result.success ? 'SUCCESS' : 'FAILED'} | Time: ${result.executionTimeMs}ms`);

        // Return 200 even on compilation/simulation errors so the frontend receives structured output & waveforms
        return res.json(result);

    } catch (err) {
        console.error('[SIMULATION ERROR]:', err);
        return res.status(500).json({
            success: false,
            output: '',
            error: err.message || 'An unexpected internal server error occurred.',
            executionTimeMs: 0,
            waveform: null,
            plots: [],
            circuitDiagram: null
        });
    }
});

// 404 handler for API routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `Endpoint not found: ${req.method} ${req.url}`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[UNHANDLED ERROR]:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error.'
    });
});

// Start listening
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('====================================================');
    console.log('         ECE CODE SIMULATOR — ONLINE PLATFORM       ');
    console.log('====================================================');
    console.log(`Server running at : http://localhost:${PORT}`);
    console.log(`Environment       : ${process.env.NODE_ENV || 'development'}`);
    console.log('----------------------------------------------------');
    const status = getEngineStatus();
    console.log(`Verilog Engine    : ${status.verilog.available ? status.verilog.version : 'NOT FOUND'}`);
    console.log(`MATLAB Engine     : ${status.matlab.available ? status.matlab.version : 'NOT FOUND'}`);
    console.log('====================================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server terminated.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server terminated.');
        process.exit(0);
    });
});