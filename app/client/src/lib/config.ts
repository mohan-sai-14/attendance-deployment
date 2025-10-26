export const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || 'https://attendance-backend-00pc.onrender.com';
};

export const config = {
  apiUrl: getApiUrl(),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};