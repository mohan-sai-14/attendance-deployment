const express = require('express');
const session = require('express-session');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const routes = require('./src/routes');
const { storage } = require('./src/storage');

// Load environment variables
dotenv.config();

const app = express();

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow all origins in development
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // In production, allow specific domains or no origin (for mobile apps)
    const allowedOrigins = [
      'https://tuattendance.netlify.app', // Replace with your actual Netlify domain
      'https://tuattendance.netlify.app', // Replace with your actual Netlify domain
      process.env.FRONTEND_URL, // Allow frontend URL from environment variable
      process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [] // Allow multiple origins from env
    ].filter(Boolean).flat();

    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.some(allowed => origin.includes(allowed.replace('https://', '').replace('http://', '')))) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      console.log('Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Access-Control-Allow-Origin']
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add security headers
app.use((req, res, next) => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; font-src 'self' data:; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );
  
  // Log all incoming requests
  console.log(`${req.method} ${req.url}`, req.body);
  next();
});

// Trust proxy for secure cookies behind proxy
app.set('trust proxy', 1);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'd8e015a7f9e3b2c4a1d6e9f8b7c0a3d2',
  resave: false,
  saveUninitialized: false,
  proxy: true, // Required for Cloudflare Tunnel
  cookie: {
    secure: process.env.NODE_ENV === 'production' ? true : 'auto', // 'auto' in development
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined
  }
}));

// API routes
app.use('/api', routes);

// Serve static files from client build directory if available
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Catch-all route for client-side routing
app.get('*', (req, res) => {
  // Check if the request is for an API route
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ 
      error: 'Not found',
      details: 'The requested API endpoint does not exist'
    });
  }
  
  // For non-API routes, serve the index.html for client-side routing
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: err.message || 'An unexpected error occurred'
  });
});

const PORT = process.env.PORT || 3000;

// Function to check and update expired sessions
async function checkAndUpdateExpiredSessions() {
  try {
    console.log('Checking for expired sessions...');
    await storage.updateExpiredSessions();
  } catch (error) {
    console.error('Error in session expiration check:', error);
  }
}

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  
  // Initial check
  checkAndUpdateExpiredSessions();
  
  // Check every 1 minute (60000 ms)
  setInterval(checkAndUpdateExpiredSessions, 60 * 1000);
  console.log('Session expiration check scheduled to run every 1 minute');
});

// Handle server shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
