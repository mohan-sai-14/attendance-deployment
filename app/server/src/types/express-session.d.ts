import { User } from './user';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    role: string;
    sessionId: string;
    authenticated: boolean;
    user?: User;
  }
}

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      name?: string;
      email?: string;
      role: string;
    }
  }
}
