import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';
import { RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';


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
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);


  useEffect(() => {
    const startTimeout = setTimeout(() => {
      initAndStart();
    }, 500);
    
    return () => {
      clearTimeout(startTimeout);
      stopScanner();
    };
  }, []);

  const initAndStart = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      console.log("Available cameras:", devices);
      setCameras(devices);

      if (devices && devices.length) {
        // Prefer back camera
        let startIndex = 0;
        const backIndex = devices.findIndex(cam =>
          cam.label.toLowerCase().includes('back') ||
          cam.label.toLowerCase().includes('rear') ||
          cam.label.toLowerCase().includes('environment')
        );
        if (backIndex >= 0) startIndex = backIndex;
        setCurrentCameraIndex(startIndex);
        await startScanner(devices[startIndex].id);
      } else {
        await startScannerFallback();
      }
    } catch (err) {
      console.error("Error enumerating cameras:", err);
      await startScannerFallback();
    }
  };

  const startScanner = async (cameraId: string) => {
    setIsStarting(true);
    setCameraError(null);
    setZoomRange(null);
    setZoomLevel(1);

    html5QrCodeRef.current = new Html5Qrcode(qrcodeRegionId, { verbose: false });

    const config = {
      fps,
      qrbox: { width: qrbox, height: qrbox },
      aspectRatio
    };

    try {
      await html5QrCodeRef.current.start(
        cameraId,
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback || ((error) => console.warn("QR scan error:", error))
      );
      console.log("Scanner started with camera:", cameraId);
      detectZoomCapability();
    } catch (err) {
      console.error("Error starting scanner:", err);
      setCameraError("Camera access error. Please ensure your camera is enabled and permissions are granted.");
    } finally {
      setIsStarting(false);
    }
  };

  const startScannerFallback = async () => {
    setIsStarting(true);
    setCameraError(null);
    html5QrCodeRef.current = new Html5Qrcode(qrcodeRegionId, { verbose: false });

    const config = {
      fps,
      qrbox: { width: qrbox, height: qrbox },
      aspectRatio
    };

    try {
      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback || ((error) => console.warn("QR scan error:", error))
      );
      detectZoomCapability();
    } catch (finalErr) {
      console.error("Failed to start scanner:", finalErr);
      setCameraError("Failed to access camera. Please check your camera permissions.");
    } finally {
      setIsStarting(false);
    }
  };

  const detectZoomCapability = () => {
    try {
      if (!html5QrCodeRef.current) return;
      const runningState = html5QrCodeRef.current.getRunningTrackSettings();
      // Access the video track to check zoom capability
      const videoElement = document.querySelector(`#${qrcodeRegionId} video`) as HTMLVideoElement;
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = track.getCapabilities() as any;
          if (capabilities.zoom) {
            setZoomRange({
              min: capabilities.zoom.min || 1,
              max: capabilities.zoom.max || 10,
              step: capabilities.zoom.step || 0.1
            });
            setZoomLevel(capabilities.zoom.min || 1);
            console.log("Zoom capability detected:", capabilities.zoom);
          }
        }
      }
    } catch (e) {
      console.log("Zoom not supported on this device:", e);
    }
  };

  const applyZoom = async (zoom: number) => {
    try {
      const videoElement = document.querySelector(`#${qrcodeRegionId} video`) as HTMLVideoElement;
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        if (track) {
          await track.applyConstraints({ advanced: [{ zoom } as any] });
          setZoomLevel(zoom);
        }
      }
    } catch (e) {
      console.error("Failed to apply zoom:", e);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current?.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error("Error stopping QR scanner:", err);
      }
    }
    html5QrCodeRef.current = null;
  };

  const switchCamera = async () => {
    if (cameras.length < 2 || isSwitching) return;
    setIsSwitching(true);

    try {
      await stopScanner();
      // Small delay to allow camera release
      await new Promise(resolve => setTimeout(resolve, 300));

      const nextIndex = (currentCameraIndex + 1) % cameras.length;
      setCurrentCameraIndex(nextIndex);
      await startScanner(cameras[nextIndex].id);
    } catch (err) {
      console.error("Error switching camera:", err);
    } finally {
      setIsSwitching(false);
    }
  };


  return (
    <div className="w-full relative">
      <div 
        id={qrcodeRegionId}
        className="w-full max-w-[300px] mx-auto aspect-square bg-gray-100 rounded-lg overflow-hidden"
      />
      
      {/* Camera Switch Button */}
      {cameras.length > 1 && !isStarting && (
        <button
          onClick={switchCamera}
          disabled={isSwitching}
          className="absolute top-2 right-2 z-10 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all active:scale-95 disabled:opacity-50 border border-white/20 shadow-lg"
          title={cameras[currentCameraIndex]?.label || 'Switch Camera'}
        >
          <RefreshCw className={`w-4 h-4 ${isSwitching ? 'animate-spin' : ''}`} />
        </button>
      )}

      {/* Zoom Controls */}
      {zoomRange && !isStarting && (
        <div className="flex items-center gap-2 mt-3 px-2 max-w-[300px] mx-auto">
          <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="range"
            min={zoomRange.min}
            max={zoomRange.max}
            step={zoomRange.step}
            value={zoomLevel}
            onChange={(e) => applyZoom(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
          />
          <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-mono min-w-[2.5rem] text-right">{zoomLevel.toFixed(1)}x</span>
        </div>
      )}

      {/* Camera Label */}
      {cameras.length > 1 && !isStarting && (
        <p className="text-[10px] text-center mt-1.5 text-muted-foreground/60 truncate max-w-[300px] mx-auto px-2">
          {cameras[currentCameraIndex]?.label || `Camera ${currentCameraIndex + 1}`}
        </p>
      )}
      
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
