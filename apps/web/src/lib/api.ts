import axios, { type AxiosRequestConfig } from "axios";
import { z } from "zod";
import { apiErrorSchema, dataEnvelope } from "@booking/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const instance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10_000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

instance.interceptors.response.use(undefined, (error: unknown) => {
  if (!axios.isAxiosError(error)) throw error;
  const res = error.response;
  if (!res) throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server");
  const parsed = apiErrorSchema.safeParse(res.data);
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    throw new ApiError(res.status, code, message, details);
  }
  throw new ApiError(res.status, "INTERNAL", `Request failed with status ${res.status}`);
});

/** Sends the request and validates the `{ data }` envelope with a zod schema. */
export async function request<S extends z.ZodType>(
  schema: S,
  config: AxiosRequestConfig,
): Promise<z.output<S>> {
  const res = await instance.request(config);
  // Unwrap the shared envelope first, then validate the payload (keeps z.output<S> inference intact).
  const envelope = dataEnvelope(z.unknown()).parse(res.data);
  return schema.parse(envelope.data);
}
