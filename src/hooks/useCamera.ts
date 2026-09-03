"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "starting" | "live" | "error";

export interface CameraApi {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: string | null;
  facing: "environment" | "user";
  start: (facing?: "environment" | "user") => Promise<void>;
  stop: () => void;
  switchCamera: () => Promise<void>;
  /** Draws the current video frame onto a canvas (natural resolution, ≤1600px). */
  captureFrame: () => HTMLCanvasElement | null;
}

export function useCamera(): CameraApi {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  const start = useCallback(
    async (requestedFacing?: "environment" | "user") => {
      const nextFacing = requestedFacing ?? facing;
      setStatus("starting");
      setError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setError(
          "Camera access isn't available on this page — it needs a secure (HTTPS) context."
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        setFacing(nextFacing);
        const video = videoRef.current;
        if (!video) throw new Error("Video element not mounted yet.");
        video.srcObject = stream;
        await video.play();
        setStatus("live");
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError") {
          setError("Camera permission denied. Allow camera access in the browser, or upload a photo instead.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setError("No usable camera found on this device. Upload a photo instead.");
        } else if (err instanceof Error && err.message) {
          setError(err.message);
        } else {
          setError("Could not start the camera. Upload a photo instead.");
        }
        setStatus("error");
      }
    },
    [facing]
  );

  const switchCamera = useCallback(async () => {
    const next = facing === "environment" ? "user" : "environment";
    await start(next);
  }, [facing, start]);

  const captureFrame = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const scale = Math.min(1, 1600 / Math.max(vw, vh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(vw * scale));
    canvas.height = Math.max(1, Math.round(vh * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, status, error, facing, start, stop, switchCamera, captureFrame };
}
