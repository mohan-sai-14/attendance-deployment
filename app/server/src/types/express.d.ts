import { User } from './user';
import { Session, SessionData } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    role: string;
    sessionId: string;
    authenticated: boolean;
    user?: User | null;
  }
}

declare global {
  namespace Express {
    // Extend the Express Request type
    interface Request {
      user?: User;
      session: Session & Partial<SessionData> & {
        user?: User | null;
      };
    }

    // Extend the Express User type
    interface User {
      id: string;
      username: string;
      name?: string;
      email?: string;
      role: string;
    }
  }
}
