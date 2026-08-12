import { Request } from 'express';

/** Express 5 types params as string | string[] — normalize to string */
export function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
}
