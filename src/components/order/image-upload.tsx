'use client';

import { useState, useRef, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useFirebase } from '@/firebase';
import { Camera, Trash2, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export interface ImageUploadProps {
  companyId: string;
  itemId: string;
  currentImageUrl?: string;
  onImageChange: (url: string | null) => void;
}

/** Max width/height for the resized image */
const MAX_W = 800;
const MAX_H = 600;

/**
 * Resize an image file to fit within MAX_W x MAX_H using a canvas,
 * returning a JPEG Blob.
 */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_W / bitmap.width, MAX_H / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);

  return new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85)
  );
}

export default function ImageUpload({
  companyId,
  itemId,
  currentImageUrl,
  onImageChange,
}: ImageUploadProps) {
  const { storage } = useFirebase();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const storagePath = `menu-items/${companyId}/${itemId}.jpg`;

  // ── Upload handler ──────────────────────────────────────────────────────
  const uploadFile = useCallback(
    async (file: File) => {
      if (!storage) return;
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Error',
          description: 'La imagen no debe superar 5 MB.',
          variant: 'destructive',
        });
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Error',
          description: 'Solo se permiten archivos de imagen.',
          variant: 'destructive',
        });
        return;
      }

      setUploading(true);
      try {
        const blob = await resizeImage(file);
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
        const downloadURL = await getDownloadURL(storageRef);
        onImageChange(downloadURL);
        toast({ title: 'Imagen subida' });
      } catch {
        toast({
          title: 'Error',
          description: 'No se pudo subir la imagen.',
          variant: 'destructive',
        });
      } finally {
        setUploading(false);
      }
    },
    [storage, storagePath, onImageChange, toast]
  );

  // ── Delete handler ──────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!storage) return;
    setDeleting(true);
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef).catch(() => {});
      onImageChange(null);
      toast({ title: 'Imagen eliminada' });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la imagen.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  }, [storage, storagePath, onImageChange, toast]);

  // ── Event handlers ──────────────────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  // Preview mode
  if (currentImageUrl) {
    return (
      <div className="relative w-full overflow-hidden rounded-lg border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentImageUrl}
          alt="Vista previa"
          className="h-48 w-full object-cover"
        />
        <div className="absolute bottom-2 right-2 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Camera className="mr-1 h-4 w-4" />
            )}
            Cambiar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-4 w-4" />
            )}
            Eliminar
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    );
  }

  // Dropzone mode
  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        disabled={uploading}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        } ${uploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-muted-foreground">
          {uploading ? 'Subiendo...' : 'Subir imagen'}
        </span>
        <span className="text-xs text-muted-foreground/70">
          Arrastra o haz clic para seleccionar
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
