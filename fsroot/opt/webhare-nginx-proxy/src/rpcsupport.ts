"use strict";

import type { ServerResponse } from "http";

export function sendReply(res: ServerResponse, error: { code: number; message: string }, result?: null, id?: string | number): void;
export function sendReply(res: ServerResponse, error: null, result: unknown, id: string | number): void;

export function sendReply(res: ServerResponse, error: { code: number; message: string } | null, result?: unknown, id?: string | number) {
  const message = error ? { id, error } : { id, result };
  res.writeHead(error ? 500 : 200,
    {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });

  res.end(JSON.stringify(message));

  if (error)
    console.log(error);
}
