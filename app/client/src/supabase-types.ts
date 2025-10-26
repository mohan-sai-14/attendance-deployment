
export interface Database {
  public: {
    Tables: {
      // Define your database tables here
      profiles: {
        Row: {
          id: string;
          username: string;
          role: 'student' | 'teacher' | 'admin';
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          role: 'student' | 'teacher' | 'admin';
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          role?: 'student' | 'teacher' | 'admin';
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          username: string;
          email: string;
          password?: string;
          password_hash?: string;
          role: 'student' | 'teacher' | 'admin';
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
        };
        Insert: {
          id: string;
          username: string;
          email: string;
          password?: string;
          password_hash?: string;
          role?: 'student' | 'teacher' | 'admin';
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          id?: string;
          username?: string;
          email?: string;
          password?: string;
          password_hash?: string;
          role?: 'student' | 'teacher' | 'admin';
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
        };
      };
    };
  };
}
