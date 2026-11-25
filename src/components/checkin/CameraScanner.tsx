import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { Button } from "../ui/Button";

// The Shape Detection API is not in TypeScript's DOM types yet; only what is used here.
interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorInstance { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> }
interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}
const detectorClass = (): BarcodeDetectorConstructor | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;

export const cameraScanningSupported = () =>
  !!detectorClass() && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

type Problem = "unsupported" | "denied" | "no-camera" | "failed" | null;
const SCAN_INTERVAL_MS = 250;

// Optional camera scanning for staff. It only reads a code and hands it to onDetected; the
// page decides what to do with it (and rejects links). Every camera track is stopped when
// the scanner closes or the page is left.
export function CameraScanner({ onDetected, onClose }: { onDetected: (value: string) => void; onClose: () => void }) {
  const { tx } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<Problem>(() => cameraScanningSupported() ? null : "unsupported");
  const [ready, setReady] = useState(false);
  const onDetectedRef = useRef(onDetected);
  useEffect(() => { onDetectedRef.current = onDetected; });

  useEffect(() => {
    const Detector = detectorClass();
    if (!Detector || !navigator.mediaDevices?.getUserMedia) return;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    const stop = () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
      stream = null;
    };
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) { stop(); return; }
        const video = videoRef.current;
        if (!video) { stop(); return; }
        video.srcObject = stream;
        await video.play();
        setReady(true);
        const detector = new Detector({ formats: ["qr_code", "code_128", "ean_13", "code_39", "data_matrix", "pdf417"] });
        let last = "";
        const tick = async () => {
          if (stopped) return;
          try {
            const [found] = await detector.detect(video);
            const value = found?.rawValue.trim();
            // The same code stays in view for many frames: report it once.
            if (value && value !== last) { last = value; onDetectedRef.current(value); }
          } catch { /* A frame that cannot be read yet; keep trying. */ }
          timer = window.setTimeout(() => void tick(), SCAN_INTERVAL_MS);
        };
        void tick();
      } catch (error) {
        stop();
        const name = error instanceof DOMException ? error.name : "";
        setProblem(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "no-camera" : "failed");
      }
    })();
    return stop;
  }, []);

  const message = problem === "unsupported"
    ? tx("Этот браузер не умеет распознавать коды камерой. Введите код вручную или используйте сканер.")
    : problem === "denied"
      ? tx("Доступ к камере запрещён. Разрешите камеру в настройках браузера или введите код вручную.")
      : problem === "no-camera"
        ? tx("Камера не найдена. Введите код вручную или используйте сканер.")
        : problem === "failed" ? tx("Не удалось включить камеру. Введите код вручную.") : "";

  return (
    <div className="mt-3 rounded-lg border p-3">
      {message ? <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{message}</p> : <>
        <video ref={videoRef} muted playsInline aria-label={tx("Изображение с камеры")} className="aspect-video w-full max-w-md rounded-md bg-black object-cover" />
        <p role="status" className="mt-2 text-sm text-muted">{ready ? tx("Наведите камеру на QR-код билета.") : tx("Включаем камеру…")}</p>
      </>}
      <Button variant="secondary" className="mt-3" onClick={onClose}>{tx("Закрыть камеру")}</Button>
    </div>
  );
}
