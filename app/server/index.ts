import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import routes from './src/routes';
import { storage } from './src/storage';

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
    
    // In production, only allow specific domains
    const allowedOrigins = [
      'https://your-production-domain.com',
      'https://www.your-production-domain.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
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
    domain: process.env.NODE_ENV === 'production' ? '.your-domain.com' : undefined
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
