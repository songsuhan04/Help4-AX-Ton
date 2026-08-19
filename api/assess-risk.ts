import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { assessRisk } from "../lib/riskScoring";

// 안부 체크 완료 시점에 위험도를 계산해 risk_assessment/elder_profile.priority_status에 반영한다.
// 근거: docs/기능설계서.md §3, plan "P0: 위험도 판정 로직 실제 연결"
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const { elderProfileId, date } = req.body ?? {};
  if (!elderProfileId || !date) {
    res.status(400).json({ error: "elderProfileId and date required" });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(200).json({ status: "skipped", reason: "supabase not configured" });
    return;
  }

  const admin = createClient(supabaseUrl, serviceKey);
  try {
    await assessRisk(admin, elderProfileId, date);
    res.status(200).json({ status: "ok" });
  } catch (err) {
    res.status(200).json({ status: "failed", error: err instanceof Error ? err.message : String(err) });
  }
}
