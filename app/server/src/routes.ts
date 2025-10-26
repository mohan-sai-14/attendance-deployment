const express = require('express');
const { storage } = require('./storage');
const { User, Session, Attendance } = require('./types');
const session = require('express-session');

// Import Express types
type Request = any;
type Response = any;
type NextFunction = any;
type RequestHandler = any;

// Define a custom request type with our session
type RequestWithUser = Request & {
  session: any; // Using any for now to avoid type issues
  user?: any;
};

const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestWithUser = req as RequestWithUser;
  if (requestWithUser.session.user) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
};

// Middleware to check if user is admin
const isAdmin = [
  isAuthenticated,
  (req: Request, res: Response, next: NextFunction) => {
    const requestWithUser = req as RequestWithUser;
    if (requestWithUser.session.user?.role === 'admin') {
      return next();
    }
    res.status(403).json({ error: 'Admin access required' });
  }
] as RequestHandler[];

// Helper function to calculate cosine similarity between two vectors
const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) return 0;
  
  const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
};

// Face verification endpoint
router.post('/verify-face', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { sessionId, faceDescriptor } = req.body;
    const userId = (req as any).session.user?.id;
    const userRole = (req as any).session.user?.role;
    
    if (!sessionId || !faceDescriptor || !Array.isArray(faceDescriptor)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: sessionId and faceDescriptor are required' 
      });
    }
    
    // Get the session
    const session = await storage.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }
    
    // Get student's face data
    const { data: studentFace, error: faceError } = await storage.supabase
      .from('student_faces')
      .select('*')
      .eq('student_id', userId)
      .single();
    
    if (faceError || !studentFace) {
      console.error('Error fetching student face data:', faceError);
      return res.status(404).json({ 
        success: false, 
        message: 'Face data not found. Please contact an administrator for enrollment.' 
      });
    }
    
    // Calculate similarity score
    const similarity = cosineSimilarity(faceDescriptor, studentFace.face_embedding);
    const SIMILARITY_THRESHOLD = 0.65; // Adjust this threshold as needed
    const isMatch = similarity >= SIMILARITY_THRESHOLD;
    
    if (!isMatch) {
      return res.json({
        success: false,
        message: 'Face verification failed. Please try again or contact support.',
        similarity,
        threshold: SIMILARITY_THRESHOLD
      });
    }
    
    // Mark attendance if verification is successful
    const attendanceData = {
      session_id: sessionId,
      student_id: userId,
      status: 'present',
      marked_at: new Date().toISOString(),
      verification_method: 'face_recognition',
      verification_score: similarity
    };
    
    const { error: attendanceError } = await storage.supabase
      .from('attendance')
      .upsert(attendanceData, { onConflict: 'session_id,student_id' });
    
    if (attendanceError) {
      console.error('Error saving attendance:', attendanceError);
      throw new Error('Failed to save attendance');
    }
    
    res.json({
      success: true,
      message: 'Attendance marked successfully',
      similarity,
      threshold: SIMILARITY_THRESHOLD
    });
    
  } catch (error) {
    console.error('Error in face verification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during face verification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  console.log('=== Login Request ===');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Check if request body is empty or missing required fields
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('Error: Empty request body');
      return res.status(400).json({ 
        success: false, 
        error: 'Empty request body',
        message: 'Request body cannot be empty' 
      });
    }
    
    // Extract credentials with case-insensitive field names
    const userId = req.body.userId || req.body.username || req.body.user_id || req.body.UserID;
    const password = req.body.password || req.body.pass;
    
    console.log('Extracted credentials:');
    console.log('- User ID:', userId);
    console.log('- Password:', password ? '[REDACTED]' : 'Not provided');
    
    // Validate required fields
    if (!userId || !password) {
      const errorMsg = `Missing required fields. Received: ${JSON.stringify({
        userId: !!userId,
        password: !!password
      })}`;
      console.error('Validation error:', errorMsg);
      
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Both username and password are required',
        received: {
          userId: !!userId,
          password: !!password
        }
      });
    }
    
    try {
      // Validate user credentials
      console.log('Validating user:', userId);
      const isValid = await storage.validateUser(userId, password);
      
      if (!isValid) {
        console.error('Invalid credentials for user:', userId);
        return res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: 'Invalid username or password'
        });
      }
      
      // Get user details
      console.log('Fetching user details for:', userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        console.error('User not found in database:', userId);
        return res.status(500).json({
          success: false,
          error: 'User not found',
          message: 'User not found in the database'
        });
      }
      
      // Store user in session
      console.log('Creating session for user:', userId);
      req.session.user = user;
      
      // Force session save
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
        } else {
          console.log('Session saved successfully');
        }
      });
      
      console.log('Session after login:', req.session);
      console.log('Session ID:', req.sessionID);
      
      // Prepare response data (excluding sensitive information)
      const { password: _, ...userData } = user;
      
      console.log('Login successful for user:', userId);
      return res.json({
        success: true,
        message: 'Login successful',
        user: userData
      });
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error during login process:', errorMessage);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred during login',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
      });
    }
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Unexpected error in login handler:', errorMessage);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && { 
        details: errorMessage,
        ...(errorStack && { stack: errorStack })
      })
    });
  }
});

// Logout endpoint
router.post('/logout', (req: Request, res: Response) => {
  try {
    if (!req.session) {
      return res.status(200).json({ success: true, message: 'No active session' });
    }
    
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ error: 'Failed to logout' });
      }
      
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  } catch (error) {
    console.error('Error in logout handler:', error);
    res.status(500).json({ error: 'Internal server error during logout' });
  }
});

// Get current user
router.get('/me', isAuthenticated, (req: Request, res: Response) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ error: 'User not found in session' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    console.error('Error in /me endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Test endpoint to create a session (for testing only)
router.post('/test/create-session', async (req: Request, res: Response) => {
  try {
    // First, create a test course
    const testCourse = {
      code: 'CS101',
      name: 'Introduction to Testing',
      department: 'Computer Science',
      semester: 1,
      credits: 3
    };

    // Create a test faculty
    const testFaculty = {
      employee_id: 'F1001',
      full_name: 'Test Faculty',
      email: 'test.faculty@example.com',
      department: 'Computer Science',
      designation: 'Professor'
    };

    // Get the Supabase client
    const supabase = storage.getClient();
    
    // Insert test course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .insert(testCourse)
      .select()
      .single();

    if (courseError) throw new Error(`Course creation failed: ${courseError.message}`);
    
    // Insert test faculty
    let faculty: any;
    const { data: newFaculty, error: facultyError } = await supabase
      .from('faculty')
      .insert(testFaculty)
      .select()
      .single();

    if (facultyError) {
      // If faculty already exists, try to fetch them
      const { data: existingFaculty, error: fetchError } = await supabase
        .from('faculty')
        .select('*')
        .eq('email', testFaculty.email)
        .single();
        
      if (fetchError) throw new Error(`Faculty creation and fetch failed: ${facultyError.message}, ${fetchError.message}`);
      
      // Use existing faculty
      faculty = existingFaculty;
    } else {
      faculty = newFaculty;
    }

    // Now create a test session
    const testSession = {
      course_id: course.id,
      faculty_id: faculty.id,
      name: 'Test Session',
      description: 'This is a test session',
      date: new Date().toISOString().split('T')[0],
      start_time: '10:00:00',
      end_time: '11:00:00',
      is_active: true,
      room_number: 'A101'
    };

    const session = await storage.createSession(testSession);
    
    if (session) {
      res.json({
        success: true,
        message: 'Test session created successfully',
        data: session
      });
    } else {
      throw new Error('Failed to create test session');
    }
  } catch (error) {
    console.error('Error creating test session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test session',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get active session (public endpoint)
router.get('/sessions/active', async (req: Request, res: Response) => {
  try {
    // Allow CORS for this endpoint
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];
    const origin = req.headers.origin;
    
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    
    console.log('Active session request received from origin:', origin);
    
    const session = await storage.getActiveSession();
    
    if (!session) {
      console.log('No active session found');
      return res.status(404).json({ 
        error: 'No active session',
        message: 'There is no active session at the moment' 
      });
    }
    
    console.log('Active session found:', session.id);
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error getting active session:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get active session for current user
router.get('/session', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ error: 'User not found in session' });
    }
    
    const session = await storage.getActiveSession(user.role === 'admin' ? undefined : user.username);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No active session found',
        data: null
      });
    }
    
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error in /session endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active session',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all sessions (admin only)
router.get('/sessions', ...isAdmin, async (req: Request, res: Response) => {
  try {
    const sessions = await storage.getAllSessions();
    res.json({
      success: true,
      data: sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Error in /sessions endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new session (admin only)
router.post('/sessions', ...isAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'Not authenticated',
        message: 'User session not found'
      });
    }
    
    // Get date and time from request
    const dateStr = req.body.date || new Date().toISOString().split('T')[0];
    const timeStr = req.body.expires_at || '23:59:59';
    
    // Parse the input date and time
    const dateParts = dateStr.split('-').map(Number);
    if (dateParts.length !== 3) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }
    const [year, month, day] = dateParts;
    
    // Parse time parts with default values
    const timeParts = timeStr.split(':');
    const hours = parseInt(timeParts[0] || '0', 10);
    const minutes = parseInt(timeParts[1] || '0', 10);
    const seconds = parseInt(timeParts[2] || '0', 10);
    
    // Create date in local timezone
    const localExpiry = new Date(Date.UTC(
      year,
      month - 1, // months are 0-indexed in JavaScript
      day,
      hours,
      minutes,
      seconds
    ));
    
    console.log('Local expiry time:', localExpiry.toString());
    console.log('UTC expiry time:', localExpiry.toISOString());
    
    const sessionData = {
      ...req.body,
      created_by: user.username,
      active: true,
      date: dateStr,
      expires_at: localExpiry.toISOString()
    };
    
    console.log('Creating session with expiry (local):', localExpiry.toString());
    console.log('Storing expiry time (UTC):', localExpiry.toISOString());
    
    const session = await storage.createSession(sessionData);
    
    if (!session) {
      throw new Error('Failed to create session');
    }
    
    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      data: session
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Expire session (admin only)
router.post('/sessions/:id/expire', ...isAdmin, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }
    
    console.log(`Expiring session with ID: ${sessionId}`);
    const success = await storage.expireSession(sessionId);
    
    if (!success) {
      console.error(`Failed to expire session: ${sessionId}`);
      return res.status(500).json({
        success: false,
        error: 'Session expiration failed',
        message: 'Failed to update session status in the database'
      });
    }
    
    res.json({ 
      success: true,
      message: 'Session expired successfully',
      sessionId
    });
  } catch (error) {
    console.error('Error in POST /sessions/:id/expire:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Failed to expire session'
    });
  }
});

// Get all attendance records (admin only)
router.get('/attendance', ...isAdmin, async (req: Request, res: Response) => {
  try {
    const attendance = await storage.getAllAttendance();
    res.json({
      success: true,
      data: attendance,
      count: attendance.length
    });
  } catch (error) {
    console.error('Error in GET /attendance:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch attendance records',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get authenticated user's attendance
router.get('/attendance/me', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.session.user;
    if (!user) {
      console.error('No user in session');
      return res.status(401).json({ 
        success: false,
        error: 'Not authenticated',
        message: 'User session not found'
      });
    }
    
    const userId = user.username;
    console.log(`Fetching attendance for user: ${userId}`);
    
    const attendance = await storage.getUserAttendance(userId);
    
    if (!attendance || attendance.length === 0) {
      console.log(`No attendance records found for user: ${userId}`);
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'No attendance records found'
      });
    }
    
    res.json({
      success: true,
      data: attendance,
      count: attendance.length
    });
  } catch (error) {
    console.error('Error in GET /attendance/me:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch attendance records',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Record attendance
router.post('/attendance', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'Not authenticated',
        message: 'User session not found'
      });
    }
    
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Session ID is required'
      });
    }
    
    console.log(`Recording attendance for user ${user.username} in session ${sessionId}`);
    
    // Call recordAttendance with the correct parameters
    const record = await storage.recordAttendance(user.username, sessionId);
    
    if (!record) {
      throw new Error('Failed to record attendance');
    }
    
    res.status(201).json({
      success: true,
      message: 'Attendance recorded successfully',
      data: record
    });
  } catch (error) {
    console.error('Error recording attendance:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to record attendance',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Check if student is checked in for current active session
router.get('/attendance/active-session', isAuthenticated, async (req: Request, res: Response) => {
  try {
    // Set CORS headers
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];
    const origin = req.headers.origin;
    
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        message: 'User session not found'
      });
    }
    
    console.log(`Checking active session for user: ${user.username}`);
    
    // Get the active session first
    const activeSession = await storage.getActiveSession();
    
    if (!activeSession) {
      console.log('No active session found');
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'No active session found'
      });
    }
    
    console.log(`Active session found: ${activeSession.id}`);
    
    // Check if the user is already checked in for this session
    const attendance = await storage.getAttendanceBySessionAndUser(activeSession.id, user.username);
    
    if (!attendance) {
      return res.json({
        success: true,
        data: {
          isCheckedIn: false,
          session: activeSession
        },
        message: 'Not checked in to active session'
      });
    }
    
    // User is already checked in
    res.json({
      success: true,
      data: {
        isCheckedIn: true,
        session: activeSession,
        attendance: attendance
      },
      message: 'Already checked in to active session'
    });
  } catch (error) {
    console.error('Error in GET /attendance/active-session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check active session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Default route for API endpoints that don't exist
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Robotics Club Attendance API',
    version: '1.0.0',
    endpoints: {
      auth: [
        { path: '/api/login', method: 'POST', description: 'User login' },
        { path: '/api/logout', method: 'POST', description: 'User logout' },
        { path: '/api/me', method: 'GET', description: 'Get current user info' }
      ],
      sessions: [
        { path: '/api/sessions', method: 'GET', description: 'Get all sessions (admin only)' },
        { path: '/api/sessions/active', method: 'GET', description: 'Get active session' },
        { path: '/api/session', method: 'GET', description: 'Get active session for current user' },
        { path: '/api/sessions', method: 'POST', description: 'Create new session (admin only)' },
        { path: '/api/sessions/:id/expire', method: 'POST', description: 'Expire a session (admin only)' }
      ],
      attendance: [
        { path: '/api/attendance', method: 'GET', description: 'Get all attendance records (admin only)' },
        { path: '/api/attendance', method: 'POST', description: 'Record attendance' },
        { path: '/api/attendance/me', method: 'GET', description: 'Get current user\'s attendance' },
        { path: '/api/attendance/active-session', method: 'GET', description: 'Check attendance status for active session' }
      ]
    }
  });
});

// Catch-all route for unknown API endpoints
router.all('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `API endpoint ${req.path} does not exist`,
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      params: req.params
    },
    documentation: '/api',
    availableEndpoints: [
      { path: '/api/login', method: 'POST', description: 'User authentication' },
      { path: '/api/logout', method: 'POST', description: 'User logout' },
      { path: '/api/me', method: 'GET', description: 'Get current user info' },
      { path: '/api/sessions', method: 'GET', description: 'Get all sessions (admin only)' },
      { path: '/api/sessions', method: 'POST', description: 'Create new session (admin only)' },
      { path: '/api/sessions/active', method: 'GET', description: 'Get active session' },
      { path: '/api/session', method: 'GET', description: 'Get active session for current user' },
      { path: '/api/attendance', method: 'GET', description: 'Get all attendance records (admin only)' },
      { path: '/api/attendance', method: 'POST', description: 'Record attendance' },
      { path: '/api/attendance/me', method: 'GET', description: 'Get current user\'s attendance' },
      { path: '/api/attendance/active-session', method: 'GET', description: 'Check attendance status for active session' }
    ]
  });
});

// Debugging route to test database connection
router.get('/debug/test-db', (req: express.Request, res: express.Response) => {
  console.log('Testing database connection...');
  
  storage.testConnection()
    .then(isConnected => {
      if (isConnected) {
        res.json({
          success: true,
          message: 'Successfully connected to Supabase'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to connect to Supabase'
        });
      }
    })
    .catch(error => {
      console.error('Error testing connection:', error);
      res.status(500).json({
        success: false,
        message: 'Error testing connection',
        error: error.message
      });
    });
});

// Debug endpoint to check table schema
router.get('/debug/schema/:table', (req: express.Request, res: express.Response) => {
  const tableName = req.params.table;
  console.log(`Checking schema for table ${tableName}...`);
  
  storage.getTableInfo(tableName)
    .then(result => {
      if (result) {
        res.json(result);
      } else {
        res.status(500).json({
          success: false,
          message: `Failed to get schema for table ${tableName}`
        });
      }
    })
    .catch(error => {
      console.error(`Error getting schema for ${tableName}:`, error);
      res.status(500).json({
        success: false,
        message: `Error getting schema for ${tableName}`,
        error: error.message
      });
    });
});

// Session code routes for QR scanner fallback
router.get('/sessions/code/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.id);
    const session = await storage.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        message: "Session not found" 
      });
    }
    
    if (!session.is_active) {
      return res.status(400).json({ 
        message: "Session is not active" 
      });
    }
    
    // Generate a simple attendance code for the session
    const attendanceCode = `${session.name.substring(0, 3).toUpperCase()}${sessionId}${new Date(session.created_at).getDate()}`;
    
    res.json({ 
      attendanceCode,
      expiresAt: session.expires_at
    });
  } catch (error) {
    console.error("Error generating attendance code:", error);
    res.status(500).json({ 
      message: "Failed to generate attendance code" 
    });
  }
});

// Verify attendance code
router.post('/attendance/code', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const requestWithUser = req as RequestWithUser;
    const user = requestWithUser.session.user;
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: "Attendance code is required" });
    }
    
    // Get all active sessions
    const sessions = await storage.getAllSessions();
    const activeSessions = sessions.filter((s: any) => s.is_active);
    
    if (activeSessions.length === 0) {
      return res.status(404).json({ message: "No active sessions found" });
    }
    
    // Try to match the code with any active session
    let matchedSession = null;
    for (const session of activeSessions) {
      const sessionCode = `${session.name.substring(0, 3).toUpperCase()}${session.id}${new Date(session.created_at).getDate()}`;
      if (sessionCode === code) {
        matchedSession = session;
        break;
      }
    }
    
    if (!matchedSession) {
      return res.status(400).json({ message: "Invalid attendance code" });
    }
    
    // Check if session has expired
    const expiryTime = new Date(matchedSession.expires_at).getTime();
    const currentTime = Date.now();
    
    if (currentTime > expiryTime) {
      await storage.expireSession(matchedSession.id);
      return res.status(400).json({ message: "Session has expired" });
    }
    
    // Check if user has already marked attendance
    const existingAttendance = await storage.getAttendanceBySessionAndUser(matchedSession.id, user.id);
    if (existingAttendance) {
      return res.status(409).json({ message: "Attendance already marked for this session" });
    }
    
    // Mark attendance
    const attendanceData = {
      user_id: user.id,
      session_id: matchedSession.id,
      check_in_time: new Date().toISOString(),
      status: "present",
    };
    
    const attendance = await storage.markAttendance(attendanceData);
    res.status(201).json(attendance);
  } catch (error) {
    console.error("Error marking attendance with code:", error);
    res.status(500).json({ message: "Failed to mark attendance" });
  }
});

// Debug route to check session
router.get('/debug/session', (req: Request, res: Response) => {
  console.log('=== Session Debug ===');
  console.log('Session ID:', req.sessionID);
  console.log('Session data:', req.session);
  console.log('Cookies:', req.headers.cookie);
  console.log('Headers:', req.headers);
  
  res.json({
    sessionID: req.sessionID,
    session: req.session,
    cookies: req.headers.cookie,
    hasUser: !!req.session.user
  });
});

// Append this at the very end of the file
router.get('/debug/login-test', async (req: Request, res: Response) => {
  try {
    console.log('Testing login with hardcoded credentials');
    
    const testUserId = 'admin'; // Use one of your actual user IDs
    const testPassword = 'admin123'; // Use the correct password
    
    console.log(`Attempting login with userId: ${testUserId}`);
    
    const isValid = await storage.validateUser(testUserId, testPassword);
    console.log(`Validation result: ${isValid}`);
    
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Login failed with test credentials',
        details: 'User validation returned false'
      });
    }
    
    const user = await storage.getUser(testUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User validation succeeded but getUser failed',
        details: 'User is null'
      });
    }
    
    console.log('User found:', {
      id: user.id,
      username: user.username,
      role: user.role
    });
    
    return res.json({
      success: true,
      message: 'Login test succeeded',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error in test login:', error);
    return res.status(500).json({
      success: false,
      message: 'Error during login test',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

module.exports = router;