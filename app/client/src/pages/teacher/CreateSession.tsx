import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { v4 as uuidv4 } from "uuid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Download, QrCode as QrCodeIcon, Check, Loader2, Clock, Calendar } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { format, addMinutes, parseISO, differenceInSeconds } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1, "Session name is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  duration: z.coerce
    .number()
    .min(1, "Duration must be at least 1 minute")
    .max(240, "Duration cannot exceed 4 hours"),
  expiresAt: z.string().min(1, "Expiration time is required"),
});

type FormValues = z.infer<typeof formSchema>;

// QR Code Data Type
interface QRCodeData {
  sessionId: string;
  name: string;
  date: string;
  time: string;
  duration: number;
  generatedAt: string;
  expiresAfter: number;
  expiresAt: string;
  timezone: string;
}

export default function QRGenerator() {
  const [qrValue, setQrValue] = useState<string>("");
  const [qrUrl, setQrUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expiryTime, setExpiryTime] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);

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
      duration: 5,
      expiresAt: format(addMinutes(new Date(), 5), "yyyy-MM-dd'T'HH:mm"),
    },
  });

  // Clear error message when form is changed
  useEffect(() => {
    const subscription = form.watch(() => {
      if (errorMessage) setErrorMessage(null);
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
        handleExpiration();
        clearInterval(timer);
      } else {
        setTimeLeft(diff);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [expiryTime]);

  const handleExpiration = useCallback(() => {
    setTimeLeft(0);
    setQrValue("");
    setQrUrl("");
    setSessionSaved(false);
    setExpiryTime(null);
    
    toast({
      variant: "destructive",
      title: "QR Code Expired",
      description: "The QR code has expired. Please generate a new one if needed.",
    });
  }, [toast]);

  const formatTimeLeft = useCallback((seconds: number | null): string => {
    if (seconds === null) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const formatDateForDB = useCallback((dateString: string): string => {
    try {
      return format(parseISO(dateString), 'yyyy-MM-dd');
    } catch (e) {
      console.error("Error formatting date:", e);
      return dateString;
    }
  }, []);

  const formatTimeForDB = useCallback((timeString: string): string => {
    try {
      return timeString; // Assuming time is already in HH:mm format
    } catch (e) {
      console.error("Error formatting time:", e);
      return timeString;
    }
  }, []);

  const generateQRCode = useCallback(async (data: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(data, { 
        errorCorrectionLevel: 'H',
        margin: 1,
        scale: 8
      });
    } catch (err) {
      console.error('Error generating QR code:', err);
      throw new Error('Failed to generate QR code');
    }
  }, []);

  const onSubmit = async (formData: FormValues) => {
    try {
      setIsSubmitting(true);
      setSessionSaved(false);
      setErrorMessage(null);
      setQrValue('');
      setQrUrl('');

      // Validate expiration time
      const localExpirationDate = new Date(formData.expiresAt);
      if (isNaN(localExpirationDate.getTime())) {
        throw new Error('Invalid expiration time');
      }
      if (localExpirationDate <= new Date()) {
        throw new Error('Expiration time must be in the future');
      }

      // Generate session data
      const sessionId = uuidv4();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      const qrData: QRCodeData = {
        sessionId,
        name: formData.name,
        date: formatDateForDB(formData.date),
        time: formatTimeForDB(formData.time),
        duration: formData.duration,
        generatedAt: new Date().toISOString(),
        expiresAfter: formData.duration,
        expiresAt: localExpirationDate.toISOString(),
        timezone
      };

      // Generate QR code
      const qrString = JSON.stringify(qrData);
      const qrUrl = await generateQRCode(qrString);
      
      // Update state
      setQrValue(qrString);
      setQrUrl(qrUrl);
      setExpiryTime(localExpirationDate);
      setSessionSaved(true);

      // Save to database
      const { error } = await supabase
        .from('sessions')
        .insert([{
          ...qrData,
          qr_code: qrString,
          is_active: true
        }])
        .single();

      if (error) throw error;

      // Refresh sessions list
      await refetchSessions();

      toast({
        title: "QR Code Generated",
        description: `Session "${formData.name}" has been created successfully.`,
      });

    } catch (error) {
      console.error("Error:", error);
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      setErrorMessage(message);
      
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadQR = useCallback(() => {
    if (!qrUrl) return;
    
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `qrcode-${form.getValues('name').replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [qrUrl, form]);

  const getMinDateTime = useCallback(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 2);
    return format(now, "yyyy-MM-dd'T'HH:mm");
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">QR Code Generator</h2>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{format(new Date(), 'PPP')}</span>
          <Clock className="h-4 w-4 ml-2" />
          <span>{format(new Date(), 'p')}</span>
        </div>
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <QrCodeIcon className="mr-2 h-5 w-5" />
              Create New Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

                <div className="grid grid-cols-2 gap-4">
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
                </div>

                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="240" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          min={getMinDateTime()}
                          step="300"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The QR code will expire at this time
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <QrCodeIcon className="mr-2 h-4 w-4" />
                      Generate QR Code
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <QrCodeIcon className="mr-2 h-5 w-5" />
                QR Code
              </span>
              {timeLeft !== null && (
                <Badge variant="outline" className="text-sm">
                  <Clock className="mr-1 h-3 w-3" />
                  Expires in {formatTimeLeft(timeLeft)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            {qrValue ? (
              <>
                <div ref={qrRef} className="p-4 bg-white rounded-lg border">
                  <QRCodeSVG
                    value={qrValue}
                    size={256}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                
                <div className="flex space-x-2 w-full">
                  <Button
                    onClick={handleDownloadQR}
                    className="flex-1"
                    disabled={!qrUrl}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download QR Code
                  </Button>
                  
                  {sessionSaved && (
                    <Button variant="outline" className="pointer-events-none">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      Saved
                    </Button>
                  )}
                </div>

                <div className="w-full space-y-2 text-sm">
                  <p className="font-medium">Session Details:</p>
                  <div className="bg-muted p-3 rounded-md">
                    <p><span className="text-muted-foreground">Name:</span> {form.watch('name')}</p>
                    <p><span className="text-muted-foreground">Date:</span> {form.watch('date')}</p>
                    <p><span className="text-muted-foreground">Time:</span> {form.watch('time')}</p>
                    <p><span className="text-muted-foreground">Duration:</span> {form.watch('duration')} minutes</p>
                    {expiryTime && (
                      <p><span className="text-muted-foreground">Expires:</span> {format(expiryTime, 'PPpp')}</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6 border-2 border-dashed rounded-lg">
                <QrCodeIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  No QR Code Generated
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Fill out the form and click "Generate QR Code" to create one
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
