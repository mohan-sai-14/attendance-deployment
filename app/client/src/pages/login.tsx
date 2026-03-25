import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import LoginForm from '../components/LoginForm';
import { ShieldCheck } from 'lucide-react';

export default function Login() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center p-4 overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-muted/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="space-y-8"
        >
          {/* Logo/Brand Section */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="flex items-center gap-2 mb-2 p-2 bg-card rounded-2xl shadow-sm border border-border">
              <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground pr-2">Attendance Portal</span>
            </div>
            <div className="h-px w-12 bg-border" />

          </div>

          {/* Login Form Container */}
          <div className="relative">
             <LoginForm />
          </div>

          {/* Footer Info */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-6">
            </div>

          </div>
        </motion.div>
      </div>


    </div>
  );
}

