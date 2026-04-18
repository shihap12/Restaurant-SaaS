import { useEffect, useRef, useState } from 'react';
import { X, Camera, AlertCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const containerId = 'qr-scanner-container';

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        // Try to extract coupon code from JSON QR
        try {
          const parsed = JSON.parse(decodedText);
          if (parsed.code) {
            stopScanner();
            onScan(parsed.code);
            return;
          }
        } catch {
          // Plain text QR — treat as coupon code
        }
        stopScanner();
        onScan(decodedText.trim().toUpperCase());
      },
      () => {} // ignore individual frame errors
    ).then(() => {
      setScanning(true);
    }).catch((err) => {
      setError(typeof err === 'string' ? err : 'Camera access denied. Please allow camera permissions.');
    });

    return () => stopScanner();
  }, []);

  const stopScanner = () => {
    scannerRef.current?.stop().catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden animate-scale-in"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Camera size={18} style={{ color: 'var(--brand-400)' }} />
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Scan QR Coupon
            </h3>
          </div>
          <button onClick={() => { stopScanner(); onClose(); }} className="btn btn-ghost btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Scanner View */}
        <div className="p-4">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertCircle size={36} className="text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Enable camera access in your browser settings
              </p>
            </div>
          ) : (
            <>
              <div id={containerId} className="rounded-2xl overflow-hidden" style={{ minHeight: 280 }} />
              {scanning && (
                <p className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>
                  Point camera at a QR coupon code
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
