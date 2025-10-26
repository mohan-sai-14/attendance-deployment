import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { User } from './types';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      res.status(400).json({ 
        error: 'Bad request',
        details: 'Username and password are required'
      });
      return;
    }

    const isValid = await storage.validateUser(userId, password);
    
    if (!isValid) {
      res.status(401).json({ 
        error: 'Authentication failed',
        details: 'Invalid username or password'
      });
      return;
    }

    const user = await storage.getUser(userId);
    
    if (!user) {
      res.status(500).json({ 
        error: 'Internal server error',
        details: 'User authenticated but profile not found'
      });
      return;
    }

    // Store user data in session
    req.session.user = user;
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'An unexpected error occurred during login'
    });
  }
};

export const logout = (req: Request, res: Response): void => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      res.status(500).json({ 
        error: 'Internal server error',
        details: 'Failed to destroy session'
      });
      return;
    }
    
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
};

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.session.user) {
    res.status(401).json({ 
      error: 'Authentication required',
      details: 'You must be logged in to access this resource'
    });
    return;
  }
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    res.status(403).json({ 
      error: 'Forbidden',
      details: 'Admin privileges required to access this resource'
    });
    return;
  }
  next();
}; 