const dotenv = require('dotenv');
const path = require('path');

// Load environment variables FIRST, before anything reads process.env
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });
dotenv.config(); // Also check cwd .env

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const MemoryStore = require('memorystore')(session);
const pg = require('pg');
const passport = require('passport');
const cors = require('cors');
const { registerRoutes } = require('./routes');
const { storage } = require('./src/storage');

const app = express();

// Build session store: use PostgreSQL if DATABASE_URL exists, otherwise MemoryStore
let sessionStore: any = undefined; 

if (process.env.DATABASE_URL) {
  console.log('Attempting to initialize PostgreSQL session store...');
  // Check if it's a Supabase URL and warn about IPv6/Port 5432
  if (process.env.DATABASE_URL.includes('supabase.co') && process.env.DATABASE_URL.includes(':5432')) {
    console.warn('[Session] WARNING: Using standard Supabase port 5432 on Render may cause IPv6 ENETUNREACH errors.');
    console.warn('[Session] TIP: Use the Transaction Pooler (port 6543) connection string instead.');
  }

  try {
    const pgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000 // Don't hang forever
    });
    
    sessionStore = new pgSession({
      pool: pgPool,
      tableName: 'session',
      createTableIfMissing: true
    });
    
    // We can't easily sync-test the pool here without async, 
    // but the store will handle errors internally.
    console.log('PostgreSQL session store configured.');
  } catch (err) {
    console.error('Failed to configure PostgreSQL session store:', err);
  }
}

if (!sessionStore) {
  console.log('Using MemoryStore (with persistence-like behavior) for sessions.');
  sessionStore = new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  });
}


// CORS configuration - Temporarily allow all origins for testing
const corsOptions = {
  origin: true, // Allow all origins temporarily
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
app.use((req: any, res: any, next: any) => {
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
const sessionConfig: any = {
  secret: process.env.SESSION_SECRET || 'd8e015a7f9e3b2c4a1d6e9f8b7c0a3d2',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production' && !process.env.DISABLE_SECURE_COOKIE ? true : false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Better for same-origin integrated deployments
  }
};
if (sessionStore) {
  sessionConfig.store = sessionStore;
}
app.use(session(sessionConfig));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// API routes
registerRoutes(app);

// Robust static file path discovery
let clientBuildPath = path.join(__dirname, 'public');
const fs = require('fs');

if (!fs.existsSync(path.join(clientBuildPath, 'index.html'))) {
  console.log('Static files not found in default path, trying alternatives...');
  const alternatives = [
    path.join(__dirname, '../client/dist'),
    path.join(__dirname, '../../client/dist'),
    path.join(process.cwd(), 'client/dist'),
    path.join(process.cwd(), 'app/client/dist'),
    path.join(process.cwd(), 'dist/public')
  ];
  
  for (const alt of alternatives) {
    if (fs.existsSync(path.join(alt, 'index.html'))) {
      clientBuildPath = alt;
      console.log('Found static files at:', alt);
      break;
    }
  }
}

console.log('Serving static files from:', clientBuildPath);
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
app.use((err: any, req: any, res: any, next: any) => {
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
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  
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
