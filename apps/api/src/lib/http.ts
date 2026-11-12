import type { Response } from "express";

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data });
}

export function noContent(res: Response): void {
  res.status(204).end();
}
