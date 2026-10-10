"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Camera, Check, ChevronLeft, ChevronRight, Clock3, Plus, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalStorage } from "@/lib/pwa/offline-storage";
import { validatePhotoFile } from "@/lib/photos/validation";
import { createCameraClient } from "@/lib/device/camera";
import type { CameraSession } from "@/lib/device/contracts";
import { createFindingPhotoRepository, createLocalPhoto } from "../services/photo.repository";
import { PHOTO_LIMITS, type FindingPhoto, type LocalPhoto, type PhotoEdits } from "../photo-contracts";

const photoStatus = {
  uploaded: { label: "Subido", className: "bg-emerald-800 text-white", icon: Check },
  pending: { label: "Pendiente", className: "bg-slate-800 text-white", icon: Clock3 },
  local: { label: "Pendiente", className: "bg-slate-800 text-white", icon: Clock3 },
  error: { label: "Error", className: "bg-red-800 text-white", icon: TriangleAlert },
} as const;

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
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const session = useRef<CameraSession | null>(null);
  const generation = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const touchStartX = useRef<number | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const stopCamera = () => { generation.current++; session.current?.stop(); session.current = null; setCapturing(false); };
  useEffect(() => () => { generation.current++; session.current?.stop(); }, []);
  useEffect(() => { changeRef.current?.({ add: added, remove: removed }); }, [added, removed]);
  useEffect(() => { onBusyChange?.(busy || capturing); }, [busy, capturing, onBusyChange]);
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

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("pwa-utt:queue-changed", refresh);
    return () => window.removeEventListener("pwa-utt:queue-changed", refresh);
  }, []);

  const visible = [...photos.filter(photo => !removed.includes(photo.id)), ...added];
  const activePreview = previewIndex === null ? null : visible[previewIndex] ?? null;
  const movePreview = (direction: number) => {
    setPreviewIndex(index => index === null || visible.length < 2 ? index : (index + direction + visible.length) % visible.length);
  };

  const add = async (file: Blob) => {
    if (visible.length >= PHOTO_LIMITS.maxPerFinding) { setMessage("Máximo tres fotos por hallazgo."); return; }
    setBusy(true);
    try {
      validatePhotoFile(file);
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

  return <section className={editable ? s.panel : s.readOnlyPanel} aria-label="Fotos del hallazgo">
    <div className={s.galleryHeader}>
      <p className={s.label}>Evidencia · {visible.length}/{PHOTO_LIMITS.maxPerFinding} fotos</p>
      {editable ? <Button type="button" variant="outline" className={s.cameraButton} disabled={busy || capturing || visible.length >= PHOTO_LIMITS.maxPerFinding} onClick={() => void openCamera()}><Camera className={s.icon} aria-hidden="true" />Usar cámara</Button> : null}
    </div>
    <div className={s.photos}>
      {visible.map((photo, index) => {
        const status = photoStatus[photo.status];
        const StatusIcon = status.icon;
        return <figure key={photo.id} className={s.photo}>
          <button type="button" className={s.previewButton} disabled={!urls[photo.id]} aria-label={`Abrir foto ${index + 1} de ${visible.length}, estado: ${status.label}`} onClick={() => setPreviewIndex(index)}>
            {urls[photo.id] ? <img src={urls[photo.id]} alt={`Evidencia ${index + 1} del hallazgo`} loading="lazy" decoding="async" className={s.image} /> : <span className={s.unavailable}>Vista previa no disponible</span>}
            <span className={`${s.statusBadge} ${status.className}`}><StatusIcon className={s.statusIcon} aria-hidden="true" />{status.label}</span>
          </button>
          {editable ? <Button type="button" variant="outline" size="icon" className={s.removeButton} disabled={busy} aria-label={`Quitar foto ${index + 1}`} onClick={() => {
            if (added.some(item => item.id === photo.id)) setAdded(current => current.filter(item => item.id !== photo.id));
            else setRemoved(current => [...current, photo.id]);
          }}><X className={s.removeIcon} aria-hidden="true" /></Button> : null}
        </figure>;
      })}
      {editable && visible.length < PHOTO_LIMITS.maxPerFinding ? <button type="button" className={s.addTile} disabled={busy || capturing} aria-label="Agregar foto del hallazgo" onClick={() => fileInput.current?.click()}><span className={s.addIconWrap}><Plus className={s.addIcon} aria-hidden="true" /></span><span>Agregar foto</span></button> : null}
    </div>
    {editable ? <>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className={s.fileInput} aria-label="Seleccionar foto del hallazgo" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void add(file); }} />
      <p className={s.hint}>JPEG, PNG o WebP · hasta 5 MiB por foto.</p>
      {capturing ? <div className={s.capture}>
        <video ref={video} muted playsInline className={s.video} aria-label="Vista previa de cámara" />
        <div className={s.captureActions}><Button type="button" className={s.touchButton} disabled={busy} onClick={() => void capture()}>Capturar foto</Button><Button type="button" variant="outline" className={s.touchButton} onClick={stopCamera}>Cancelar cámara</Button></div>
      </div> : null}
    </> : null}
    {message ? <p role="alert" className={s.error}>{message}</p> : null}

    <Dialog.Root open={activePreview !== null} onOpenChange={open => { if (!open) setPreviewIndex(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={s.lightboxOverlay} />
        {activePreview ? <Dialog.Content className={s.lightbox} aria-label="Visor de evidencia" onKeyDown={event => {
          if (event.key === "ArrowRight") { event.preventDefault(); movePreview(1); }
          if (event.key === "ArrowLeft") { event.preventDefault(); movePreview(-1); }
        }} onTouchStart={event => { touchStartX.current = event.changedTouches[0]?.clientX ?? null; }} onTouchEnd={event => {
          if (touchStartX.current === null) return;
          const distance = event.changedTouches[0]?.clientX - touchStartX.current;
          if (Math.abs(distance) > 48) movePreview(distance < 0 ? 1 : -1);
          touchStartX.current = null;
        }}>
          <Dialog.Title className={s.lightboxTitle}>Foto {(previewIndex ?? 0) + 1} de {visible.length}</Dialog.Title>
          <Dialog.Description className={s.visuallyHidden}>Usa las flechas, desliza o activa los controles para cambiar de foto.</Dialog.Description>
          <div className={s.lightboxImageWrap}>
            {urls[activePreview.id] ? <img src={urls[activePreview.id]} alt={`Evidencia ${(previewIndex ?? 0) + 1} del hallazgo, ${photoStatus[activePreview.status].label}`} decoding="async" className={s.lightboxImage} /> : null}
          </div>
          {visible.length > 1 ? <>
            <Button type="button" variant="outline" size="icon" className={`${s.viewerButton} ${s.previousButton}`} aria-label="Foto anterior" onClick={() => movePreview(-1)}><ChevronLeft className={s.viewerIcon} aria-hidden="true" /></Button>
            <Button type="button" variant="outline" size="icon" className={`${s.viewerButton} ${s.nextButton}`} aria-label="Foto siguiente" onClick={() => movePreview(1)}><ChevronRight className={s.viewerIcon} aria-hidden="true" /></Button>
          </> : null}
          <div className={s.lightboxStatus}>{photoStatus[activePreview.status].label}</div>
          <Dialog.Close asChild><Button type="button" variant="outline" size="icon" className={s.closeButton} aria-label="Cerrar visor"><X className={s.viewerIcon} aria-hidden="true" /></Button></Dialog.Close>
        </Dialog.Content> : null}
      </Dialog.Portal>
    </Dialog.Root>
  </section>;
}

const s = {
  panel: "space-y-2.5",
  readOnlyPanel: "mt-3 space-y-2.5",
  galleryHeader: "flex min-w-0 flex-wrap items-center justify-between gap-2",
  label: "text-xs font-semibold text-secondary-foreground",
  cameraButton: "min-h-11 whitespace-nowrap px-3 text-xs",
  icon: "mr-1.5 size-4 shrink-0",
  photos: "grid min-w-0 grid-cols-3 gap-2",
  photo: "relative aspect-square min-w-0",
  previewButton: "group relative block size-full overflow-hidden rounded-md bg-secondary text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default",
  image: "size-full object-cover transition-transform motion-safe:group-hover:scale-[1.03]",
  unavailable: "grid size-full place-items-center px-2 text-center text-xs text-secondary-foreground",
  statusBadge: "absolute bottom-1 left-1 inline-flex max-w-[calc(100%-0.5rem)] items-center gap-1 rounded-sm px-1.5 py-1 text-[10px] font-semibold leading-none shadow-sm",
  statusIcon: "size-3 shrink-0",
  removeButton: "absolute right-1 top-1 z-10 size-11 min-h-11 min-w-11 rounded-full border-0 bg-slate-950/80 p-0 text-white shadow-sm hover:bg-slate-950 focus-visible:ring-2 focus-visible:ring-white",
  removeIcon: "size-4",
  addTile: "flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-primary/50 bg-secondary/40 px-1 text-center text-xs font-medium text-primary transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60",
  addIconWrap: "grid size-9 place-items-center rounded-full bg-card",
  addIcon: "size-5",
  fileInput: "sr-only",
  hint: "text-xs leading-5 text-muted-foreground",
  capture: "space-y-2",
  video: "max-h-64 w-full rounded-md bg-slate-950",
  captureActions: "flex flex-wrap gap-2",
  touchButton: "min-h-11",
  error: "text-sm text-destructive",
  lightboxOverlay: "fixed inset-0 z-50 bg-slate-950/95",
  lightbox: "fixed inset-0 z-50 grid h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden rounded-none border-0 bg-slate-950 p-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] text-white focus:outline-none sm:p-6",
  lightboxTitle: "text-center text-sm font-medium text-white/90",
  visuallyHidden: "sr-only",
  lightboxImageWrap: "grid min-h-0 place-items-center",
  lightboxImage: "max-h-full max-w-full object-contain",
  viewerButton: "absolute top-1/2 z-10 size-11 min-h-11 min-w-11 -translate-y-1/2 rounded-full border-white/30 bg-slate-900/80 p-0 text-white hover:bg-slate-800 focus-visible:ring-white",
  previousButton: "left-2 sm:left-6",
  nextButton: "right-2 sm:right-6",
  viewerIcon: "size-5",
  lightboxStatus: "pb-1 text-center text-xs text-white/80",
  closeButton: "absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)] z-10 size-11 min-h-11 min-w-11 rounded-full border-white/30 bg-slate-900/80 p-0 text-white hover:bg-slate-800 focus-visible:ring-white sm:right-6",
};
