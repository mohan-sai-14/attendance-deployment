import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { createRoot } from 'react-dom/client';

// Browser-compatible QR code generation utility
export const generateQRCodeDataURL = (text: string, size: number = 256): Promise<string> => {
  return new Promise((resolve) => {
    // Create a temporary container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    // Create root and render QRCodeSVG
    const root = createRoot(container);
    
    // Render the QR code SVG
    root.render(
      React.createElement(QRCodeSVG, {
        value: text,
        size: size,
        level: 'H',
        includeMargin: true
      })
    );

    // Wait for render and convert to data URL
    setTimeout(() => {
      const svgElement = container.querySelector('svg');
      if (svgElement) {
        // Convert SVG to canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          canvas.width = size;
          canvas.height = size;
          
          // Create image from SVG
          const svgData = new XMLSerializer().serializeToString(svgElement);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL('image/png');
            URL.revokeObjectURL(url);
            
            // Cleanup
            root.unmount();
            document.body.removeChild(container);
            
            resolve(dataURL);
          };
          img.src = url;
        } else {
          // Fallback: cleanup and resolve empty
          root.unmount();
          document.body.removeChild(container);
          resolve('');
        }
      } else {
        // Fallback: cleanup and resolve empty
        root.unmount();
        document.body.removeChild(container);
        resolve('');
      }
    }, 100);
  });
};