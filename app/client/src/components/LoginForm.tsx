import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, Lock, User, AtSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const formSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormValues = z.infer<typeof formSchema>;

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      emailOrUsername: '',
      password: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      await signIn(values.emailOrUsername, values.password);
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Login Failed',
        description: error instanceof Error ? error.message : 'An error occurred during login',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.1,
          },
        },
      }}
      className="w-full"
    >
      <Card className="border-[#E5E7EB] shadow-xl bg-white rounded-2xl overflow-hidden">
        <CardHeader className="space-y-2 pb-6 pt-8 text-center border-b border-[#F3F4F6]">
          <motion.div variants={itemVariants} className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-xl bg-[#10B981]/10 flex items-center justify-center text-[#10B981]">
              <Lock className="h-6 w-6" />
            </div>
          </motion.div>
          <motion.div variants={itemVariants}>
            <CardTitle className="text-2xl font-bold tracking-tight text-[#111827]">Welcome Back</CardTitle>
          </motion.div>
          <motion.div variants={itemVariants}>
            <CardDescription className="text-gray-500 text-sm">
              Enter your credentials to access your dashboard
            </CardDescription>
          </motion.div>
        </CardHeader>
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <motion.div variants={itemVariants}>
                <FormField
                  control={form.control}
                  name="emailOrUsername"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Email or Username</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-[#10B981] transition-colors" />
                          <Input
                            placeholder="e.g. jdoe@college.edu"
                            className="pl-10 h-12 bg-gray-50/50 border-[#E5E7EB] focus:border-[#10B981] focus:ring-[#10B981]/20 rounded-xl transition-all"
                            disabled={isLoading}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Password</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-[#10B981] transition-colors" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            className="pl-10 pr-10 h-12 bg-gray-50/50 border-[#E5E7EB] focus:border-[#10B981] focus:ring-[#10B981]/20 rounded-xl transition-all"
                            disabled={isLoading}
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div variants={itemVariants} className="pt-4">
                <Button
                  type="submit"
                  className="w-full h-12 bg-[#374151] hover:bg-[#1f2937] text-white font-bold rounded-xl shadow-lg shadow-gray-200 transition-all flex items-center justify-center gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Sign In
                    </>
                  )}
                </Button>
              </motion.div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="pb-8 pt-0 flex justify-center border-t border-[#F3F4F6] mt-2 pt-6">
          <p className="text-xs text-gray-500">
            Forgot password? <span className="text-[#10B981] font-semibold cursor-pointer hover:underline uppercase tracking-tight">Contact Admin</span>
          </p>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

export default LoginForm;

