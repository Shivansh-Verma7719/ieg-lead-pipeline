import { config } from "dotenv";
config();
import handler from "../api/cron";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const req = { headers: {} } as VercelRequest;
const res = {
  status: (code: number) => ({
    json: (data: any) => console.log(`[Status ${code}]`, data)
  })
} as unknown as VercelResponse;

console.log("▶️ Starting local dev run...");
handler(req, res).catch(console.error);
