import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import routes from './routes';
import { storage } from './storage';

// Log environment
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('Current working directory:', process.cwd());

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env');
console.log('Loading environment variables from:', envPath);

try {
  dotenv.config({ path: envPath });
  console.log('Environment variables loaded successfully');
} catch (error) {
  console.error('Error loading .env file:', error);
  process.exit(1);
}

// Verify required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration middleware
const corsMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Set CORS headers
  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://attendance-deployment-git-main-mohans-projects-0d57f7f8.vercel.app',
    'https://attendance-deployment.vercel.app',
  ];
  
  const origin = req.headers.origin || '';
  
  // Common CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, Accept, Accept-Encoding, Accept-Language',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Authorization, Cache-Control, Pragma',
    'Access-Control-Max-Age': '86400' // 24 hours
  };
  
  // Allow all origins for now (can be restricted later)
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.header(key, value as string);
  });
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  return next();
};

// Apply CORS middleware
app.use(corsMiddleware);

// Add preflight handler for all routes
app.options('*', corsMiddleware);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key', // Change this to a secure secret in production
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: process.env.NODE_ENV === 'production' ? undefined : undefined // Let browser handle domain
  },
  name: 'connect.sid', // Use standard session name
  proxy: true, // Trust first proxy (important for Render)
  rolling: true // Reset expiration on each request
}));

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message
  });
});

// Parse JSON bodies
app.use(express.json());

// Trust first proxy (for secure cookies in production)
app.set('trust proxy', 1);

// CORS pre-flight is already handled by corsMiddleware
// No need for additional CORS configuration

// Routes
app.use('/api', routes);

// Root endpoint redirect
app.get('/', (req, res) => {
  res.redirect('/api');
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// Start server
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
  console.log(`Server is running on port ${PORT}`);
  
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