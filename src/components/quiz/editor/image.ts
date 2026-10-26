"use client";

import { uploadToStorage } from "@/components/cv/editor/upload";

// Question pictures go to the uploads bucket like note images (public, one folder per user). Big
// photos are made smaller first: a class of phones loads every picture at once.

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const EDGE = 1600;
const MAX_BYTES = 10 * 1024 * 1024;

async function shrink(file: File): Promise<File> {
  // GIFs stay as they are (they may move).
  if (file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    return blob && blob.size < file.size ? new File([blob], "picture.webp", { type: "image/webp" }) : file;
  } catch {
    return file;
  }
}

/** Uploads a picture for a question; its public URL, or null when it failed. */
export async function uploadQuizImage(file: File, userId: string): Promise<string | null> {
  if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_BYTES) return null;
  return uploadToStorage(await shrink(file), userId);
}
