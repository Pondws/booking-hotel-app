"use client";

import { useMutation } from "@tanstack/react-query";
import { IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_TYPES } from "@booking/shared";
import { toThai } from "@/lib/messages-th";
import { uploadImage } from "./api";

export const IMAGE_ACCEPT = IMAGE_UPLOAD_TYPES.join(",");
export const IMAGE_UPLOAD_HINT = `JPEG, PNG หรือ WebP ไม่เกินไฟล์ละ ${IMAGE_UPLOAD_MAX_BYTES / 1024 / 1024} MB`;

export type UploadResult = {
  urls: string[];
  failed: { name: string; reason: string }[];
};

function checkFile(file: File): string | null {
  if (!(IMAGE_UPLOAD_TYPES as readonly string[]).includes(file.type))
    return "ไม่ใช่ไฟล์ JPEG, PNG หรือ WebP";
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) return `ใหญ่เกิน ${IMAGE_UPLOAD_MAX_BYTES / 1024 / 1024} MB`;
  return null;
}

/**
 * Uploads one or many files (in parallel). Resolves with the URLs that made it, in the picked
 * order, plus the files that didn't — one bad file doesn't drop the rest.
 */
export function useUploadImages() {
  return useMutation({
    mutationFn: async (files: File[]): Promise<UploadResult> => {
      const results = await Promise.allSettled(
        files.map(async (file) => {
          const problem = checkFile(file);
          if (problem) throw new Error(problem);
          return (await uploadImage(file)).url;
        }),
      );
      const urls: string[] = [];
      const failed: UploadResult["failed"] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") urls.push(r.value);
        else
          failed.push({
            name: files[i]?.name ?? "ไฟล์",
            reason:
              r.reason instanceof Error ? toThai(r.reason.message) : "อัปโหลดไม่สำเร็จ",
          });
      });
      return { urls, failed };
    },
  });
}
