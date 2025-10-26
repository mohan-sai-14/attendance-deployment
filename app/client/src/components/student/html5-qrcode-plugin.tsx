import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';


// Define the props interface
interface Html5QrcodePluginProps {
  fps?: number;
  qrbox?: number;
  aspectRatio?: number;
  disableFlip?: boolean;
  qrCodeSuccessCallback: (decodedText: string, decodedResult: any) => void;
  qrCodeErrorCallback?: (errorMessage: string, error: any) => void;
}


const qrcodeRegionId = "html5qr-code-full-region";


export function Html5QrcodePlugin({
  fps = 10,
  qrbox = 250,
  aspectRatio = 1.0,
  disableFlip = false,
  qrCodeSuccessCallback,
  qrCodeErrorCallback,
}: Html5QrcodePluginProps) {
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);


  useEffect(() => {
    // Wait a brief moment to allow UI to render before starting camera
    const startTimeout = setTimeout(() => {
      startScanner();
    }, 500);
    
    return () => {
      clearTimeout(startTimeout);
      stopScanner();
    };
  }, []);
  
  const startScanner = async () => {
    // Create instance of Html5Qrcode with verbose logging
    html5QrCodeRef.current = new Html5Qrcode(qrcodeRegionId, { verbose: false });
    
    setIsStarting(true);
    setCameraError(null);


    const config = {
      fps,
      qrbox: { width: qrbox, height: qrbox },
      aspectRatio
    };
    
    try {
      console.log("Attempting to get cameras...");
      // Get available cameras first
      const devices = await Html5Qrcode.getCameras();
      console.log("Available cameras:", devices);
      
      if (devices && devices.length) {
        // Prefer the back camera on mobile devices
        let selectedCamera = devices[0].id;
        const backCamera = devices.find(camera => 
          camera.label.toLowerCase().includes('back') || 
          camera.label.toLowerCase().includes('rear')
        );
        
        if (backCamera) {
          console.log("Back camera found, using:", backCamera.label);
          selectedCamera = backCamera.id;
        }
        
        // Start scanning with selected camera
        console.log("Starting scanner with camera:", selectedCamera);
        await html5QrCodeRef.current.start(
          selectedCamera,
          config,
          qrCodeSuccessCallback,
          qrCodeErrorCallback || ((error) => console.warn("QR code scanning error:", error))
        );
        console.log("Scanner started successfully");
      } else {
        // Fallback to environment facing camera if no devices found
        console.log("No cameras found, trying generic environment camera");
        await html5QrCodeRef.current.start(
          { facingMode: "environment" },
          config,
          qrCodeSuccessCallback,
          qrCodeErrorCallback || ((error) => console.warn("QR code scanning error:", error))
        );
        console.log("Scanner started with environment camera");
      }
    } catch (err) {
      console.error("Error starting scanner:", err);
      setCameraError("Camera access error. Please ensure your camera is enabled and you've granted permission.");
      
      // Try one more time with just environment facing mode
      try {
        console.log("Trying one more time with environment camera");
        await html5QrCodeRef.current?.start(
          { facingMode: "environment" },
          config,
          qrCodeSuccessCallback,
          qrCodeErrorCallback || ((error) => console.warn("QR code scanning error:", error))
        );
        setCameraError(null);
      } catch (finalErr) {
        console.error("Failed to start scanner:", finalErr);
        setCameraError("Failed to access camera. Please check your camera permissions or try scanning the code using the manual entry method.");
      }
    } finally {
      setIsStarting(false);
    }
  };
  
  const stopScanner = () => {
    if (html5QrCodeRef.current?.isScanning) {
      html5QrCodeRef.current
        .stop()
        .catch((err) => console.error("Error stopping QR scanner:", err));
    }
  };


  return (
    <div className="w-full">
      <div 
        id={qrcodeRegionId}
        className="w-full max-w-[300px] mx-auto aspect-square bg-gray-100 rounded-lg overflow-hidden"
      />
      
      {isStarting && (
        <p className="text-sm text-center mt-2 text-blue-500">
          Starting camera... Please wait.
        </p>
      )}
      
      {cameraError && (
        <div className="text-sm text-center mt-2 text-red-500 p-2 bg-red-50 rounded">
          {cameraError}
        </div>
      )}
      
      <p className="text-xs text-center mt-2 text-gray-500">
        Position the QR code within the box to scan
      </p>
    </div>
  );
}


// Add default export to support both import styles
export default Html5QrcodePlugin;
