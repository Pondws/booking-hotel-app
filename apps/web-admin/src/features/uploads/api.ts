import { uploadedImageSchema } from "@booking/shared";
import { request } from "@/lib/api";

/** Sends the raw file; the API checks type + size and returns its public URL. */
export function uploadImage(file: File) {
  return request(uploadedImageSchema, {
    method: "POST",
    url: "/api/admin/uploads/images",
    data: file,
    headers: { "Content-Type": file.type },
    timeout: 60_000,
  });
}
