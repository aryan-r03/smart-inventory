"use client";
import { useEffect, useRef, useState } from "react";
import { X, QrCode } from "lucide-react";
import { inventoryApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
}

export function QRScannerModal({ onClose }: Props) {
  const scannerRef = useRef<any>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let scanner: any;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            handleScan(decodedText);
            scanner.stop();
          },
          () => {}
        );
        setScanning(true);
      } catch (e) {
        console.warn("Camera not available:", e);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleScan = async (code: string) => {
    setLoading(true);
    try {
      const res = await inventoryApi.scanBarcode(code);
      toast.success(`Found: ${res.data.item_name}`);
      onClose();
      router.push(`/inventory?search=${encodeURIComponent(code)}`);
    } catch {
      toast.error("Item not found for this code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl animate-fade-up">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-primary" />
            <h2 className="font-display font-600">QR / Barcode Scanner</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Camera viewfinder */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-h-64">
            <div id="qr-reader" className="w-full h-full" />
            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">
                Starting camera…
              </div>
            )}
            {/* Corner brackets */}
            <div className="absolute inset-0 pointer-events-none">
              {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos, i) => (
                <div key={i} className={`absolute ${pos} w-8 h-8 border-2 border-primary ${
                  i === 0 ? "border-r-0 border-b-0" :
                  i === 1 ? "border-l-0 border-b-0" :
                  i === 2 ? "border-r-0 border-t-0" : "border-l-0 border-t-0"
                }`} />
              ))}
            </div>
          </div>

          {/* Manual entry */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 text-center">Or enter code manually</p>
            <div className="flex gap-2">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && manualCode && handleScan(manualCode)}
                placeholder="SKU or barcode…"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={() => manualCode && handleScan(manualCode)}
                disabled={!manualCode || loading}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                {loading ? "…" : "Look up"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
