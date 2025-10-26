import { motion } from 'framer-motion';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { useEffect, useState } from 'react';
import LoginForm from '../components/LoginForm';

type Ball = {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  xMovement: number;
  yMovement: number;
};

export default function Login() {
  const [balls, setBalls] = useState<Ball[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const colors = [
      'bg-blue-500/20',
      'bg-indigo-500/15',
      'bg-primary/10',
      'bg-cyan-500/15',
      'bg-indigo-500/15',
      'bg-blue-400/15',
    ];

    const newBalls = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 8 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: Math.random() * 25 + 15,
      delay: Math.random() * 5,
      xMovement: Math.random() * 60 - 30,
      yMovement: Math.random() * 60 - 30,
    }));

    setBalls(newBalls);
    setTimeout(() => setIsLoaded(true), 300);
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background Balls */}
      {balls.map((ball) => (
        <motion.div
          key={ball.id}
          className={`absolute rounded-full ${ball.color}`}
          style={{
            width: `${ball.size}px`,
            height: `${ball.size}px`,
            left: `${ball.x}%`,
            top: `${ball.y}%`,
          }}
          animate={{
            x: [0, ball.xMovement, 0],
            y: [0, ball.yMovement, 0],
          }}
          transition={{
            duration: ball.duration,
            delay: ball.delay,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          }}
        />
      ))}

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg p-8 border border-border">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
                <p className="text-muted-foreground">Sign in to your account</p>
              </div>
              <ThemeToggle />
            </div>
            <LoginForm />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
