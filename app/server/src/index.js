const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();

// Enable CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Parse request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Simple root route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Simple API routes
app.get('/api/sessions/active', (req, res) => {
  res.json({ 
    id: 1, 
    name: "Test Session", 
    created_by: "admin", 
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    is_active: true
  });
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
}); 