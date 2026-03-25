export const getApiUrl = (path: string = '') => {
  // Always use relative paths when deployed (e.g., vercel.app), forcing same-origin proxy
  if (typeof window !== 'undefined' && 
      window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1') {
    return path;
  }
  
  // Local development fallback
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  return `${baseUrl}${path}`;
};

export const config = {
  apiUrl: getApiUrl(),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};