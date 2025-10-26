import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { v4 as uuidv4 } from "uuid"; // Import UUID generator
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Download, QrCode as QrCodeIcon, Check, Loader2, MapPin, Calendar, Clock, Timer, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase"; // Import Supabase client
import { useQuery } from "@tanstack/react-query";
import { format, addMinutes, parseISO } from "date-fns"; // Add this import for date formatting
import { getCurrentPosition, formatDistance } from "@/lib/location"; // Import location utilities

const formSchema = z.object({
  name: z.string().min(1, "Session name is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  duration: z.coerce
    .number()
    .min(1, "Duration must be at least 1 minute")
    .max(60, "Duration cannot exceed 60 minutes"),
  expiresAt: z.string().min(1, "Expiration time is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function QRGenerator() {
  const [qrValue, setQrValue] = useState<string>("");
  const [qrUrl, setQrUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expiryTime, setExpiryTime] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [teacherLocation, setTeacherLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Query to refresh sessions list
  const { refetch: refetchSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data } = await supabase.from('sessions').select('*');
      return data || [];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:mm'),
      duration: 5, // Set default duration to 5 minutes
      expiresAt: format(addMinutes(new Date(), 5), "yyyy-MM-dd'T'HH:mm"), // Default to 5 minutes from now
    },
  });

  // Clear error message when form is changed
  useEffect(() => {
    const subscription = form.watch(() => {
      if (errorMessage) {
        setErrorMessage(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, errorMessage]);

  // Set up countdown timer
  useEffect(() => {
    if (!expiryTime) return;
    
    const timer = setInterval(() => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((expiryTime.getTime() - now.getTime()) / 1000));
      
      if (diff <= 0) {
        setTimeLeft(0);
        setQrValue("");
        setQrUrl("");
        setSessionSaved(false);
        setExpiryTime(null);
        clearInterval(timer);
        toast({
          variant: "destructive",
          title: "QR Code Expired",
          description: "The QR code has expired. Please generate a new one if needed.",
        });
      } else {
        setTimeLeft(diff);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [expiryTime, toast]);
  
  // Format time left for display
  const formatTimeLeft = (seconds: number | null): string => {
    if (seconds === null) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date for better consistency with database
  const formatDateForDB = (dateString: string) => {
    try {
      // Keep the date in YYYY-MM-DD format
      return dateString;
    } catch (e) {
      console.error("Error formatting date:", e);
      return dateString;
    }
  };

  // Format time for better consistency with database
  const formatTimeForDB = (timeString: string) => {
    try {
      // Keep the time in HH:MM format
      return timeString;
    } catch (e) {
      console.error("Error formatting time:", e);
      return timeString;
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      setSessionSaved(false);
      setErrorMessage(null);
      setIsGettingLocation(true);
      
      // Reset QR code and URL when form is submitted
      setQrValue('');
      setQrUrl('');
      
      // Get teacher's current location
      let teacherCoords = null;
      try {
        const coords = await getCurrentPosition();
        teacherCoords = {
          lat: coords.latitude,
          lng: coords.longitude
        };
        setTeacherLocation(teacherCoords);
        
        toast({
          title: "Location Captured",
          description: "Your location has been recorded for this session.",
        });
      } catch (locationError) {
        console.error("Location error:", locationError);
        toast({
          variant: "destructive",
          title: "Location Required",
          description: locationError instanceof Error ? locationError.message : "Unable to get your location. Please enable location access.",
        });
        throw new Error("Location access is required to generate QR code");
      } finally {
        setIsGettingLocation(false);
      }
      
      // Format date and time for consistency
      const formattedDate = formatDateForDB(data.date);
      const formattedTime = formatTimeForDB(data.time);
      
      // Generate a unique session ID
      const sessionId = uuidv4();

      // Parse the expiration time from the form (local time) with validation
      if (!data.expiresAt) {
        throw new Error('Expiration time is required');
      }
      
      const localExpirationDate = new Date(data.expiresAt);
      if (isNaN(localExpirationDate.getTime())) {
        throw new Error('Invalid expiration time');
      }
      
      // Ensure the expiration is in the future
      if (localExpirationDate <= new Date()) {
        throw new Error('Expiration time must be in the future');
      }
      
      // Get timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Create QR data object with formatted date and time
      const qrData = {
        sessionId: sessionId,
        name: data.name,
        date: formattedDate,
        time: formattedTime,
        duration: data.duration,
        generatedAt: new Date().toISOString(),
        expiresAfter: data.duration,
        expiresAt: localExpirationDate.toISOString(),
        timezone: timezone
      };
      
      // For debugging
      console.log('Local expiration time:', localExpirationDate.toString());
      console.log('Local timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);

      // Convert to string for QR code
      const qrString = JSON.stringify(qrData);
      setQrValue(qrString);

      // Generate QR code URL for download
      const url = await QRCode.toDataURL(qrString);
      setQrUrl(url);

      // Set expiry time for countdown (use local time for display)
      setExpiryTime(localExpirationDate);
      
      // For debugging
      console.log("Form data being submitted:", {
        ...data,
        localExpirationTime: localExpirationDate.toString(),
        localExpirationISO: localExpirationDate.toISOString()
      });
      
      // Prepare the data for insertion
      // The backend will handle the timezone conversion to UTC
      const sessionData = {
        name: data.name,
        date: formattedDate,
        time: formattedTime,
        duration: data.duration,
        qr_code: qrString,
        expires_at: localExpirationDate.toISOString(), // Send as ISO string, backend will handle conversion
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Include timezone
        is_active: true,
        teacher_lat: teacherCoords?.lat,
        teacher_lng: teacherCoords?.lng,
        allowed_radius_meters: 150 // Default 150 meters radius
      };
      
      console.log("Session data being sent to server:", sessionData);
      
      console.log("Inserting session with data:", sessionData);

      // Insert session data into Supabase
      const { data: insertedData, error } = await supabase
        .from('sessions')
        .insert([sessionData])
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        let errorMessage = `Database error: ${error.message}`;
        
        // Provide more user-friendly error messages for common issues
        if (error.message.includes('timezone')) {
          errorMessage = "Error with timezone information. Please try again.";
        } else if (error.message.includes('expires_at')) {
          errorMessage = "Invalid expiration time. Please select a future time.";
        }
        
        throw new Error(errorMessage);
      }

      // Update UI state
      setSessionSaved(true);
      refetchSessions();

      // Show success message with local time
      toast({
        title: "QR Code Generated",
        description: `New QR code has been generated and will expire at ${format(localExpirationDate, 'dd/MM/yyyy HH:mm')}.`,
      });
    } catch (error) {
      console.error("Error generating QR code or saving session:", error);
      
      // Set user-friendly error message
      let errorMessage = 'An unknown error occurred';
      
      if (error instanceof Error) {
        if (error.message.includes('Expiration time must be in the future')) {
          errorMessage = 'Please select a future time for the session expiration.';
        } else if (error.message.includes('Invalid expiration time')) {
          errorMessage = 'The selected expiration time is not valid. Please try again.';
        } else if (error.message.includes('timezone')) {
          errorMessage = 'There was an issue with timezone information. Please refresh and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setErrorMessage(errorMessage);
      
      toast({
        variant: "destructive",
        title: "Failed to generate QR code",
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadQR = () => {
    if (!qrUrl) return;

    const link = document.createElement("a");
    link.href = qrUrl;
    link.download = `qrcode-${form.getValues().name.replace(/\s+/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            QR Code Generator
          </h1>
          <p className="text-muted-foreground mt-1">Create attendance QR codes with location tracking</p>
        </div>
        {teacherLocation && (
          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
            <MapPin className="h-3 w-3 mr-1" />
            Location Captured
          </Badge>
        )}
      </motion.div>

      {/* Error Message */}
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div>
              <h3 className="font-semibold">Error Occurred</h3>
              <p className="text-sm mt-1">{errorMessage}</p>
              <p className="text-sm mt-2 text-destructive/80">Please check your data and try again.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}>
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Create New Session
              </CardTitle>
              <CardDescription>Fill in the details to generate a QR code</CardDescription>
            </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Session Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter session name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => {
                    // Format the current date for min attribute
                    const now = new Date();
                    // Add 2 minutes to current time as minimum expiration
                    now.setMinutes(now.getMinutes() + 2);
                    const minDateTime = format(now, "yyyy-MM-dd'T'HH:mm");
                    
                    return (
                      <FormItem>
                        <FormLabel>Expiration Time</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type="datetime-local" 
                              {...field}
                              
                               // 5-minute increments
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value);
                                
                                // Only log if we have a valid date
                                if (value) {
                                  const date = new Date(value);
                                  if (!isNaN(date.getTime())) {
                                    console.log("Selected expiration time:", date.toISOString());
                                  }
                                }
                              }}
                            />
                          </div>
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Select a time at least 2 minutes in the future
                        </p>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <QrCodeIcon className="mr-2 h-4 w-4" /> Generate QR Code
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        </motion.div>

        {/* QR Code Display Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}>
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCodeIcon className="h-5 w-5 text-primary" />
                QR Code Output
              </CardTitle>
              <CardDescription>Your generated QR code will appear here</CardDescription>
            </CardHeader>
          <CardContent>
            {qrValue ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center space-y-6">
                <div
                  ref={qrRef}
                  className="w-64 h-64 border-4 border-primary/20 p-4 rounded-2xl flex items-center justify-center relative bg-white shadow-2xl"
                >
                  <QRCodeSVG
                    value={qrValue}
                    size={240}
                    level="H"
                    includeMargin={true}
                  />
                  {timeLeft !== null && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-3 -right-3 bg-gradient-to-br from-yellow-500 to-orange-500 text-white font-bold rounded-full w-14 h-14 flex flex-col items-center justify-center shadow-lg">
                      <Timer className="h-4 w-4" />
                      <span className="text-xs">{formatTimeLeft(timeLeft)}</span>
                    </motion.div>
                  )}
                </div>
                <div className="flex flex-col items-center gap-3 w-full">
                  <Button onClick={downloadQR} className="w-full shadow-lg hover:shadow-xl transition-shadow">
                    <Download className="mr-2 h-4 w-4" /> Download QR Code
                  </Button>
                  {sessionSaved && (
                    <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                      <Check className="h-3 w-3 mr-1" /> Saved to Database
                    </Badge>
                  )}
                </div>
                {timeLeft !== null && (
                  <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                    <div className="flex items-center justify-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
                      <Clock className="h-4 w-4" />
                      <span>Expires in <span className="font-bold">{formatTimeLeft(timeLeft)}</span></span>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <QrCodeIcon className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No QR Code Generated</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Fill the form and click generate to create a QR code
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        </motion.div>
      </div>
    </div>
  );
}
