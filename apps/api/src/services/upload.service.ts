import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { IMAGE_UPLOAD_TYPES, type ImageUploadType } from "@booking/shared";
import { env } from "../env";
import { AppError } from "../lib/app-error";

const FORMATS: Record<ImageUploadType, { ext: string; matches: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: ".jpg", matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": {
    ext: ".png",
    matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  "image/webp": {
    ext: ".webp",
    matches: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  },
};

function isImageUploadType(value: string): value is ImageUploadType {
  return (IMAGE_UPLOAD_TYPES as readonly string[]).includes(value);
}

function invalid(message: string): AppError {
  return new AppError(400, "VALIDATION_FAILED", message);
}

/**
 * Writes an uploaded image under a random name and returns that file name.
 * The bytes must match the declared type, so a renamed HTML/SVG file can't be stored as an image.
 */
export async function saveImage(body: unknown, contentType: string | undefined): Promise<string> {
  const type = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!isImageUploadType(type)) throw invalid("Upload a JPEG, PNG or WebP image");
  if (!Buffer.isBuffer(body) || body.length === 0) throw invalid("The file is empty");
  const format = FORMATS[type];
  if (!format.matches(body)) throw invalid("The file isn't a valid image of that type");

  const fileName = `${randomUUID()}${format.ext}`;
  await mkdir(env.UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(env.UPLOAD_DIR, fileName), body, { flag: "wx" });
  return fileName;
}
