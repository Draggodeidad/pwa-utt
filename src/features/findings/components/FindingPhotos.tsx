"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalStorage } from "@/lib/pwa/offline-storage";
import { validatePhotoFile } from "@/lib/photos/validation";
import { createCameraClient } from "@/lib/device/camera";
import type { CameraSession } from "@/lib/device/contracts";
import { createFindingPhotoRepository, createLocalPhoto } from "../services/photo.repository";
import { PHOTO_LIMITS, type FindingPhoto, type LocalPhoto, type PhotoEdits } from "../photo-contracts";

const labels = { local: "Guardado local", pending: "Pendiente de subir", uploaded: "Subido", error: "Error: conserva la foto para reintentar" };

type Props = { owner: string; inspectionId: string; findingId: string; editable?: boolean; onChange?: (edits: PhotoEdits) => void; onBusyChange?: (busy: boolean) => void };
export function FindingPhotos({ owner, inspectionId, findingId, editable = false, onChange, onBusyChange }: Props) {
  const [photos, setPhotos] = useState<readonly FindingPhoto[]>([]);
  const [added, setAdded] = useState<LocalPhoto[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => { onBusyChange?.(busy || capturing); }, [busy, capturing, onBusyChange]);
  const video = useRef<HTMLVideoElement>(null);
  const session = useRef<CameraSession | null>(null);
  const generation = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const changeRef = useRef(onChange); changeRef.current = onChange;

  const stopCamera = () => { generation.current++; session.current?.stop(); session.current = null; setCapturing(false); };
  useEffect(() => () => { generation.current++; session.current?.stop(); }, []);
  useEffect(() => { changeRef.current?.({ add: added, remove: removed }); }, [added, removed]);
  useEffect(() => {
    let active = true;
    const resources: string[] = [];
    let storage: LocalStorage | null = null;
    const load = async () => {
      try {
        storage = await LocalStorage.open();
        const repository = createFindingPhotoRepository({ owner, storage, fetch: (...args) => fetch(...args) });
        const result = await repository.list(findingId);
        if (!active) return;
        const existing = result.status === "success" ? result.value : [];
        setPhotos(existing);
        if (result.status !== "success") setMessage("No se pudo consultar la evidencia autorizada.");
        const next: Record<string, string> = {};
        for (const photo of [...existing, ...added]) {
          if (removed.includes(photo.id)) continue;
          const staged = added.find(item => item.id === photo.id);
          const read = staged?.blob ? { status: "success" as const, value: staged.blob } : await repository.read(photo.id);
          if (!active) break;
          if (read.status === "success") { const url = URL.createObjectURL(read.value); resources.push(url); next[photo.id] = url; }
        }
        if (active) setUrls(next);
      } catch { if (active) setMessage("No se pudo abrir la evidencia local. Intenta de nuevo."); }
      finally { storage?.close(); }
    };
    void load();
    return () => { active = false; for (const url of resources) URL.revokeObjectURL(url); storage?.close(); };
  }, [owner, findingId, added, removed, revision]);
  // Refresh confirmed state after the shared queue changes; avoid restarting camera.
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("pwa-utt:queue-changed", refresh);
    return () => window.removeEventListener("pwa-utt:queue-changed", refresh);
  }, []);

  const visible = [...photos.filter(photo => !removed.includes(photo.id)), ...added];
  const add = async (file: Blob) => {
    if (visible.length >= PHOTO_LIMITS.maxPerFinding) { setMessage("Máximo tres fotos por hallazgo."); return; }
    setBusy(true);
    try {
      validatePhotoFile(file);
      // Validate before creating a pending attachment; Image fallback covers older browsers.
      if (typeof createImageBitmap === "function") {
        const bitmap = await createImageBitmap(file);
        try { if (bitmap.width * bitmap.height > 25_000_000) throw new Error("invalid-format"); }
        finally { bitmap.close(); }
      } else {
        const preview = URL.createObjectURL(file);
        try {
          await new Promise<void>((resolve, reject) => {
            const image = new Image();
            image.onload = () => image.naturalWidth * image.naturalHeight <= 25_000_000 ? resolve() : reject(new Error("invalid-format"));
            image.onerror = () => reject(new Error("invalid-format")); image.src = preview;
          });
        } finally { URL.revokeObjectURL(preview); }
      }
      const photo = await createLocalPhoto({ id: crypto.randomUUID(), owner, inspectionId, findingId, file });
      setAdded(current => [...current, photo]); setMessage(null);
    } catch { setMessage("Imagen no válida: JPEG, PNG o WebP, hasta 5 MiB y 25 megapíxeles."); }
    finally { setBusy(false); }
  };
  const openCamera = async () => {
    if (visible.length >= PHOTO_LIMITS.maxPerFinding) { setMessage("Máximo tres fotos por hallazgo."); return; }
    const attempt = ++generation.current;
    setBusy(true);
    const client = createCameraClient({
      isSecureContext: () => window.isSecureContext,
      mediaDevices: navigator.mediaDevices ?? null,
      objectUrls: URL, now: Date.now,
      captureFrame: async () => {
        const element = video.current;
        if (!element?.videoWidth || !element.videoHeight) throw new Error("capture-failed");
        const canvas = document.createElement("canvas"); canvas.width = element.videoWidth; canvas.height = element.videoHeight;
        const context = canvas.getContext("2d"); if (!context) throw new Error("capture-failed");
        context.drawImage(element, 0, 0);
        return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("capture-failed")), "image/jpeg", 0.85));
      },
    });
    const result = await client.open();
    if (attempt !== generation.current) { if (result.status === "success") result.value.stop(); return; }
    setBusy(false);
    if (result.status !== "success") { setMessage("Cámara no disponible o permiso denegado. Puedes seleccionar un archivo."); return; }
    session.current = result.value; setCapturing(true); setMessage(null);
  };
  useEffect(() => {
    if (capturing && video.current && session.current) {
      video.current.srcObject = session.current.stream;
      void video.current.play().catch(() => { session.current?.stop(); setCapturing(false); setMessage("No se pudo iniciar la cámara. Selecciona un archivo."); });
    }
  }, [capturing]);
  const capture = async () => {
    setBusy(true);
    const attempt = generation.current;
    const result = await session.current?.capture();
    if (attempt !== generation.current) return;
    stopCamera();
    setBusy(false);
    if (result?.status === "success") await add(result.value);
    else setMessage("No se pudo capturar la foto. Selecciona un archivo.");
  };

  return <section className={s.panel} aria-label="Fotos del hallazgo">
    <p className={s.label}>Evidencia opcional · {visible.length}/3 fotos</p>
    <div className={s.photos}>{visible.map(photo => <figure key={photo.id} className={s.photo}>
      {urls[photo.id] ? <img src={urls[photo.id]} alt="Evidencia del hallazgo" className={s.image} /> : <p className={s.hint}>Vista no disponible sin conexión</p>}
      <figcaption className={s.hint}>{labels[photo.status]}</figcaption>
      {editable ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => {
        if (added.some(item => item.id === photo.id)) setAdded(current => current.filter(item => item.id !== photo.id));
        else setRemoved(current => [...current, photo.id]);
      }}><Trash2 className={s.icon} />Quitar foto</Button> : null}
    </figure>)}</div>
    {editable ? <>
      <p className={s.hint}>JPEG, PNG o WebP · hasta 5 MiB por foto. Se guardan al confirmar el hallazgo.</p>
      <div className={s.actions}>
        <Button type="button" variant="outline" disabled={busy || capturing || visible.length >= 3} onClick={() => void openCamera()}><Camera className={s.icon} />Usar cámara</Button>
        <Button type="button" variant="outline" disabled={busy || capturing || visible.length >= 3} onClick={() => fileInput.current?.click()}><ImagePlus className={s.icon} />Seleccionar foto</Button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className={s.fileInput} aria-label="Seleccionar foto del hallazgo" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void add(file); }} />
      </div>
      {capturing ? <div className={s.capture}>
        <video ref={video} muted playsInline className={s.video} aria-label="Vista previa de cámara" />
        <div className={s.actions}><Button type="button" disabled={busy} onClick={() => void capture()}>Capturar foto</Button><Button type="button" variant="outline" onClick={stopCamera}>Cancelar cámara</Button></div>
      </div> : null}
    </> : null}
    {message ? <p role="alert" className={s.error}>{message}</p> : null}
  </section>;
}
const s = {
  panel: "space-y-3 rounded-lg border border-slate-200 p-3",
  label: "text-sm font-semibold text-slate-900",
  hint: "text-xs text-slate-600",
  photos: "grid grid-cols-1 gap-3 sm:grid-cols-3",
  photo: "space-y-2",
  image: "h-32 w-full rounded-md object-contain",
  actions: "flex flex-wrap gap-2",
  icon: "mr-2 h-4 w-4",
  fileInput: "sr-only",
  capture: "space-y-2",
  video: "max-h-64 w-full rounded-md bg-slate-900",
  error: "text-sm text-red-700",
};
