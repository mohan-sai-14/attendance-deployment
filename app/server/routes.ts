import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./src/storage";
import { loginSchema, insertUserSchema, insertSessionSchema, insertAttendanceSchema } from "@shared/schema";
import { z } from "zod";
import { randomBytes } from "crypto";
import session from "express-session";
import memorystore from "memorystore";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

// Extend the Express Session Data type
declare module 'express-session' {
  interface SessionData {
    userId: string;
    role: string;
    sessionId: string;
    authenticated: boolean;
  }
}

// Extend the Express Request type to include user
declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      role: string;
    }
  }
}

export async function registerRoutes(app: Express): Promise<void> {
  // Auth middleware
  const isAuthenticated = (req: Request & { user?: Express.User }, res: Response, next: () => void) => {
    // Set JSON content type for all responses
    res.setHeader('Content-Type', 'application/json');
    
    // Check if there's a valid session
    if (!req.session) {
      return res.status(401).json({
        success: false,
        message: "No session found"
      });
    }

    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    next();
  };

  // Add global middleware to set JSON content type
  app.use((req: Request, res: Response, next: () => void) => {
    res.setHeader('Content-Type', 'application/json');
    next();
  });

  // Configure session storage with secure settings
  const MemoryStore = memorystore(session);
  const sessionConfig: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax' as boolean | 'lax' | 'strict' | 'none',
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    }) as any, // Type assertion to bypass type checking for memorystore
  };

  // Session middleware with type assertion to handle memorystore compatibility
  app.use(session(sessionConfig as any));

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username" });
        }
        if (user.password !== password) {
          return done(null, false, { message: "Invalid password" });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  const isAdmin = (req: Request, res: Response, next: Function) => {
    // Ensure JSON content type for auth responses
    res.setHeader('Content-Type', 'application/json');
    
    if (req.session && req.session.userId && req.session.role === "admin") {
      return next();
    }
    console.log("Admin authorization failed for user:", req.session?.userId);
    res.status(403).json({ message: "Forbidden - Admin access required" });
  };

  // Auth routes
  app.post("/api/login", (req, res, next) => {
    try {
      console.log("Login request received:", req.body);
      
      let loginData;
      try {
        loginData = loginSchema.parse(req.body);
      } catch (zodError) {
        console.error("Login validation error:", zodError);
        return res.status(400).json({ 
          success: false,
          message: "Invalid login data", 
          errors: zodError instanceof z.ZodError ? zodError.errors : undefined 
        });
      }
      
      const { username, password } = loginData;
      
      passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) {
          console.error("Passport authentication error:", err);
          return res.status(500).json({ 
            success: false,
            message: "Authentication error occurred" 
          });
        }
        
        if (!user) {
          console.log("Authentication failed for user:", username);
          return res.status(401).json({ 
            success: false,
            message: info.message || "Authentication failed" 
          });
        }
        
        req.logIn(user, (err) => {
          if (err) {
            console.error("Session login error:", err);
            return res.status(500).json({ 
              success: false,
              message: "Session error occurred" 
            });
          }
          
          req.session.userId = user.id;
          req.session.role = user.role;
          
          console.log("User logged in successfully:", username);
          return res.status(200).json({ 
            success: true,
            data: {
              id: user.id, 
              username: user.username, 
              role: user.role, 
              name: user.name 
            }
          });
        });
      })(req, res, next);
    } catch (error) {
      console.error("Login route error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid input data", 
          errors: error.errors 
        });
      }
      return res.status(500).json({ 
        success: false,
        message: "Server error during login" 
      });
    }
  });

  app.post("/api/logout", (req, res) => {
    console.log("Logout request received");
    
    // Set content type header for JSON response
    res.setHeader('Content-Type', 'application/json');
    
    req.logout((err) => {
      if (err) {
        console.error("Error during logout:", err);
        return res.status(500).json({ message: "Error during logout" });
      }
      
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Error destroying session" });
        }
        
        console.log("User logged out successfully");
        res.status(200).json({ message: "Logged out successfully" });
      });
    });
  });

  app.get("/api/me", isAuthenticated, async (req, res) => {
    console.log("User info request received");
    
    // Set content type header for JSON response
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const user = await storage.getUser(req.session.userId);
      
      if (!user) {
        console.log("User not found for session ID:", req.session.userId);
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log("User info returned for:", user.username);
      res.status(200).json({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } catch (error) {
      console.error("Error fetching user data:", error);
      res.status(500).json({ message: "Error fetching user data" });
    }
  });

  // User management routes
  app.get("/api/users", isAdmin, async (req: Request, res: Response) => {
    const users = await storage.getAllUsers();
    res.json(users.map(user => ({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    })));
  });

  app.get("/api/users/students", isAdmin, async (req: Request, res: Response) => {
    const students = await storage.getUsersByRole("student");
    res.json(students.map(student => ({
      id: student.id,
      username: student.username,
      name: student.name,
      email: student.email,
      status: student.status
    })));
  });

  app.post("/api/users", isAdmin, async (req: Request<{}, {}, { username: string; password: string; name: string; email: string; role: string }>, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);
      
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }
      
      const user = await storage.createUser(userData);
      res.status(201).json({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  });

  app.put("/api/users/:id", isAdmin, async (req: Request<{ id: string }, {}, { username?: string; password?: string; name?: string; email?: string; role?: string; status?: string }>, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const userData = req.body;
      
      const updatedUser = await storage.updateUser(userId, userData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        id: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/users/:id", isAdmin, async (req: Request<{ id: string }>, res: Response) => {
    const userId = parseInt(req.params.id);
    const success = await storage.deleteUser(userId);
    
    if (!success) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(204).end();
  });

  // Session management routes
  app.post("/api/sessions", isAdmin, async (req, res, next) => {
    try {
      const { name, expires_after } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Session name is required" });
      }

      // Deactivate any currently active session
      const activeSession = await storage.getActiveSession();
      if (activeSession) {
        await storage.expireSession(activeSession.id);
      }
      
      // Calculate expiration time
      const expiresAt = new Date(Date.now() + (expires_after || 20 * 60 * 1000));

      // Create new session
      const userId = req.user?.id || 0; // Fallback to 0 or handle as needed
      const newSession = await storage.createSession({
        name,
        created_by: userId,
        expires_at: expiresAt.toISOString(),
        is_active: true
      });

      res.status(201).json(newSession);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sessions", isAuthenticated, async (req, res) => {
    const sessions = await storage.getAllSessions();
    res.json(sessions);
  });

  app.get("/api/sessions/active", async (req, res) => {
    try {
      const session = await storage.getActiveSession();
      
      if (!session) {
        return res.status(200).json({ 
          success: false,
          message: 'No active session found'
        });
      }

      // Add formatted date and time properties for the client
      const sessionData = {
        ...session,
        date: new Date(session.created_at).toLocaleDateString(),
        time: new Date(session.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
        // If duration is in milliseconds, convert to minutes
        duration: session.duration || Math.round((new Date(session.expires_at).getTime() - new Date(session.created_at).getTime()) / 60000)
      };
      
      console.log("Enhanced session data:", sessionData);
      
      return res.status(200).json({
        success: true,
        data: sessionData
      });
    } catch (error) {
      console.error("Error getting active session:", error);
      return res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  });

  app.get("/api/sessions/:id", isAuthenticated, async (req, res) => {
    const sessionId = parseInt(req.params.id);
    const session = await storage.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    res.json(session);
  });

  app.put("/api/sessions/:id/expire", isAdmin, async (req, res) => {
    try {
    const sessionId = parseInt(req.params.id);
      const session = await storage.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // First get all students
      const students = await storage.getUsersByRole("student");
      
      // Get all students who already marked attendance
      const attendanceRecords = await storage.getAttendanceBySession(sessionId);
      
      // Find students who did not mark attendance (absent)
      const presentStudentIds = attendanceRecords.map(record => record.user_id);
      const absentStudents = students.filter(student => !presentStudentIds.includes(student.id));
      
      // Mark absent students
      for (const student of absentStudents) {
        await storage.markAttendance({
          user_id: student.id,
          session_id: sessionId,
          check_in_time: new Date().toISOString(),
          status: "absent",
        });
      }
      
      // Mark the session as expired
    const success = await storage.expireSession(sessionId);
    
      res.json({ 
        message: "Session expired successfully", 
        absentStudents: absentStudents.length
      });
    } catch (error) {
      console.error("Error expiring session:", error);
      res.status(500).json({ message: "Failed to expire session" });
    }
  });

  app.put("/api/sessions/:id", isAdmin, async (req, res, next) => {
    try {
      const sessionId = parseInt(req.params.id);
      const sessionData = req.body;
      
      const updatedSession = await storage.updateSession(sessionId, sessionData);
      if (!updatedSession) {
      return res.status(404).json({ message: "Session not found" });
    }
    
      res.json(updatedSession);
    } catch (error) {
      next(error);
    }
  });

  // Attendance routes
  app.post("/api/attendance", isAuthenticated, async (req, res, next) => {
    try {
      const user = req.user as any;
      const { sessionId } = req.body;
      
      // Check if session exists and is active
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (!session.is_active) {
        return res.status(400).json({ message: "Session is not active" });
      }
      
      // Check if session has expired
      const expiryTime = new Date(session.expires_at).getTime();
      const currentTime = Date.now();
      
      if (currentTime > expiryTime) {
        // Automatically deactivate expired sessions
        await storage.expireSession(sessionId);
        return res.status(400).json({ message: "Session has expired" });
      }
      
      // Check if user has already marked attendance for this session
      const existingAttendance = await storage.getAttendanceBySessionAndUser(sessionId, user.id);
      if (existingAttendance) {
        return res.status(409).json({ message: "Attendance already marked for this session" });
      }
      
      // Allow admins to mark attendance for other users
      const userId = req.body.manual && req.session.role === 'admin' ? req.body.userId : user.id;
      
      // Store user details in attendance record
      const attendanceData = {
        user_id: userId,
        session_id: sessionId,
        check_in_time: new Date().toISOString(),
        status: "present",
      };
      
      const attendance = await storage.markAttendance(attendanceData);
      res.status(201).json(attendance);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/attendance/session/:id", isAuthenticated, async (req, res) => {
    const sessionId = parseInt(req.params.id);
    const attendanceRecords = await storage.getAttendanceBySession(sessionId);
    
    // If user is admin, return all records
    if ((req.user as any).role === "admin") {
      return res.json(attendanceRecords);
    }
    
    // If student, only return their own records
    const userAttendance = attendanceRecords.filter(record => record.userId === (req.user as any).id);
    res.json(userAttendance);
  });

  app.get("/api/attendance/user/:id", isAuthenticated, async (req, res) => {
    const userId = parseInt(req.params.id);
    
    // Students can only view their own attendance
    if ((req.user as any).role !== "admin" && (req.user as any).id !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const attendanceRecords = await storage.getAttendanceByUser(userId);
    res.json(attendanceRecords);
  });

  app.get("/api/attendance/me", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).id;
    const attendanceRecords = await storage.getAttendanceByUser(userId);
    
    // Get all sessions to enrich the data
    const sessions = await storage.getAllSessions();
    const sessionsMap = new Map(sessions.map(session => [session.id, session]));
    
    const enrichedRecords = attendanceRecords.map(record => ({
      ...record,
      session: sessionsMap.get(record.sessionId)
    }));
    
    res.json(enrichedRecords);
  });

  // Excel export mock endpoints (in a real app, this would generate actual Excel files)
  app.get("/api/export/attendance/:sessionId", isAdmin, async (req, res) => {
    const sessionId = parseInt(req.params.id);
    res.json({ message: "Excel export functionality would be implemented here" });
  });

  app.get("/api/export/students", isAdmin, async (req, res) => {
    res.json({ message: "Excel export functionality would be implemented here" });
  });

  // Add a simple text code for attendance as fallback
  app.get("/api/sessions/code/:id", isAuthenticated, async (req, res) => {
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
      // This is a fallback mechanism when QR codes don't work
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
  app.post("/api/attendance/code", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Attendance code is required" });
      }
      
      // Get all active sessions
      const sessions = await storage.getAllSessions();
      const activeSessions = sessions.filter(s => s.is_active);
      
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
}
