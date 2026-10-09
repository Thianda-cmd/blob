import { createClient } from "@/lib/supabase/client";

// The CV photo goes to the same place as note and slide images (bucket "uploads", one folder per
// user, public URL). A copy of uploadToStorage in src/components/editor/imageUpload.ts, so the CV
// editor doesn't pull in the note editor.

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** Uploads a picture and returns its public URL, or null when it failed. */
export async function uploadToStorage(file: File, userId: string) {
  const supabase = createClient();
  const fromName = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  const ext = /^(png|jpe?g|gif|webp)$/.test(fromName) ? fromName : file.type.split("/")[1] || "png";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("uploads").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) return null;
  return supabase.storage.from("uploads").getPublicUrl(path).data.publicUrl;
}

/** The longest side of an uploaded photo: about 670 dpi at the largest size a design prints it (45 mm). */
const PHOTO_EDGE = 1200;

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Older Safari: an <img> also turns the picture the way the camera held it.
    const img = new Image();
    const url = URL.createObjectURL(file);
    try {
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * A phone photo is several MB, and the browser puts it into the PDF as it is: a CV of 4 MB that
 * application portals may refuse. Shrinks it to PHOTO_EDGE px as a JPEG (about 200 KB). Small
 * pictures, and anything that fails, stay as they are.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  try {
    const pic = await decode(file);
    const w = "naturalWidth" in pic ? pic.naturalWidth : pic.width;
    const h = "naturalHeight" in pic ? pic.naturalHeight : pic.height;
    const k = Math.min(1, PHOTO_EDGE / Math.max(w, h));
    const done = () => "close" in pic && pic.close();
    if (k === 1 && file.size < 400 * 1024) {
      done();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * k);
    canvas.height = Math.round(h * k);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      done();
      return file;
    }
    // A JPEG has no transparency: see-through parts of a PNG become white paper, not black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(pic, 0, 0, canvas.width, canvas.height);
    done();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Resolves once the browser has the picture (or gave up), so it doesn't pop in empty. */
export function preload(src: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
    setTimeout(resolve, 8000);
  });
}
