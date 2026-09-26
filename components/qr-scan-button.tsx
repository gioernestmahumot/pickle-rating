"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { playerIdFromCode } from "@/lib/check-in";
import type { PlayerSummary } from "@/lib/types";

interface DetectedCode {
  rawValue: string;
}
interface Detector {
  detect(source: HTMLVideoElement): Promise<DetectedCode[]>;
}
type DetectorClass = new (options: { formats: string[] }) => Detector;

function detectorClass(): DetectorClass | null {
  return typeof window !== "undefined" && "BarcodeDetector" in window
    ? (window as unknown as { BarcodeDetector: DetectorClass }).BarcodeDetector
    : null;
}

/**
 * Scans a player's check-in QR with the camera (Chrome on Android and others
 * with BarcodeDetector). Elsewhere, such as iPhone Safari, it explains the
 * phone-camera route, which opens the record form with that player added.
 */
export function QrScanButton({ onPlayer }: { onPlayer: (player: PlayerSummary) => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const onPlayerRef = useRef(onPlayer);
  useEffect(() => {
    onPlayerRef.current = onPlayer;
  }, [onPlayer]);

  useEffect(() => {
    if (!open) return;
    const Detector = detectorClass();
    if (!Detector) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;

    const found = async (id: string) => {
      const { data } = await getSupabaseBrowserClient().from("players").select("id, display_name, region, city").eq("id", id).maybeSingle();
      if (stopped) return;
      if (data) {
        onPlayerRef.current(data as PlayerSummary);
        setOpen(false);
      } else {
        setMessage("That code is not a Pickle Rating player.");
      }
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        setMessage("Camera access was blocked. Allow the camera for this site, or use your phone camera app instead.");
        return;
      }
      if (stopped || !videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => undefined);
      const detector = new Detector({ formats: ["qr_code"] });
      const tick = async () => {
        if (stopped || !videoRef.current) return;
        try {
          for (const code of await detector.detect(videoRef.current)) {
            const id = playerIdFromCode(code.rawValue);
            if (id) {
              await found(id);
              return;
            }
          }
        } catch {
          /* frame not ready yet */
        }
        frame = window.requestAnimationFrame(() => void tick());
      };
      void tick();
    })();

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn w-full border border-dashed border-line-strong bg-surface text-link"
        onClick={() => {
          setMessage(detectorClass() ? "" : "This browser can't scan inside the app. Open your phone's camera app and point it at their code instead: it opens this form with them added.");
          setOpen(Boolean(detectorClass()));
        }}
      >
        <svg className="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10" /></svg>
        Scan a player&apos;s QR
      </button>
      {open && (
        <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-2">
          <video ref={videoRef} className="aspect-square w-full rounded-lg bg-black object-cover" muted playsInline />
          <button type="button" className="btn-secondary w-full" onClick={() => setOpen(false)}>Stop scanning</button>
        </div>
      )}
      {message && <p role="status" className="text-sm text-ink-2">{message}</p>}
    </div>
  );
}
