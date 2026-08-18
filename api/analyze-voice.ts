import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// 음성 분석 — 실패해도 하루 기록은 이미 저장되어 있으므로 안전하게 무시된다 (fire-and-forget).
// 근거: docs/기능설계서.md §2.2, plan §"Gemini 연동 범위"
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const { voiceResponseId } = req.body ?? {};
  if (!voiceResponseId) {
    res.status(400).json({ error: "voiceResponseId required" });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!supabaseUrl || !serviceKey) {
    res.status(200).json({ status: "skipped", reason: "supabase not configured" });
    return;
  }

  const admin = createClient(supabaseUrl, serviceKey);

  if (!geminiKey) {
    await admin.from("voice_response").update({ analysis_status: "skipped" }).eq("id", voiceResponseId);
    res.status(200).json({ status: "skipped", reason: "no gemini key" });
    return;
  }

  try {
    const { data: row, error } = await admin
      .from("voice_response")
      .select("audio_url")
      .eq("id", voiceResponseId)
      .single();
    if (error || !row) throw error ?? new Error("voice_response not found");

    const { data: signed } = await admin.storage.from("voice").createSignedUrl(row.audio_url, 300);
    if (!signed) throw new Error("failed to sign audio url");

    const audioResp = await fetch(signed.signedUrl);
    const audioBuffer = Buffer.from(await audioResp.arrayBuffer());

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: "이 음성은 독거 어르신의 안부 응답입니다. 발화 속도, 침묵 비율, 전반적인 소견을 한국어로 간단히 분석해 JSON으로 답하세요. 형식: {\"transcript\": string, \"speech_rate_wpm\": number|null, \"silence_ratio\": number|null, \"observations\": string}" },
                { inline_data: { mime_type: "audio/webm", data: audioBuffer.toString("base64") } },
              ],
            },
          ],
        }),
      }
    );
    const geminiJson = await geminiResp.json();
    const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let parsed: { transcript?: string; speech_rate_wpm?: number; silence_ratio?: number } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // Gemini가 JSON이 아닌 자유 텍스트로 답할 수 있음 — 원문은 analysis_json에 그대로 보존
    }

    await admin
      .from("voice_response")
      .update({
        analysis_status: "ok",
        analysis_json: { raw: text },
        transcript: parsed.transcript ?? null,
        speech_rate: parsed.speech_rate_wpm ?? null,
        silence_ratio: parsed.silence_ratio ?? null,
      })
      .eq("id", voiceResponseId);

    res.status(200).json({ status: "ok" });
  } catch (err) {
    await admin.from("voice_response").update({ analysis_status: "failed" }).eq("id", voiceResponseId);
    res.status(200).json({ status: "failed", error: err instanceof Error ? err.message : String(err) });
  }
}
