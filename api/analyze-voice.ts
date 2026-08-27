import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assessRisk } from "../lib/riskScoring";

async function assessRiskForVoice(admin: SupabaseClient, voiceResponseId: string): Promise<void> {
  const { data: voice } = await admin
    .from("voice_response")
    .select("daily_checkin_id")
    .eq("id", voiceResponseId)
    .maybeSingle();
  if (!voice?.daily_checkin_id) return;
  const { data: checkin } = await admin
    .from("daily_checkin")
    .select("elder_profile_id,date")
    .eq("id", voice.daily_checkin_id)
    .maybeSingle();
  if (!checkin) return;
  await assessRisk(admin, checkin.elder_profile_id, checkin.date);
}

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  // 안 들리는 부분을 그럴듯하게 지어내지 않도록 명시적으로 막는다.
                  // 실사용에서 주변 대화가 섞인 녹음을 어르신 본인의 말처럼 받아쓴 사례가 있었다.
                  text:
                    "이 음성은 독거 어르신의 안부 응답입니다. 아래 규칙을 지켜 한국어로 분석하고 JSON으로만 답하세요.\n" +
                    "1. transcript에는 실제로 명확히 들린 말만 적으세요. 추측하거나 문맥으로 보완하지 마세요.\n" +
                    "2. 들리지 않거나 알아들을 수 없으면 그 부분을 적지 말고 (불명확)으로 표시하세요.\n" +
                    "3. 발화가 전혀 없으면 transcript는 \"(발화 없음)\"으로만 하세요.\n" +
                    "4. 말소리가 여러 사람이거나 TV·주변 대화로 보이면 observations에 반드시 그 사실을 적으세요.\n" +
                    "5. speech_rate_wpm과 silence_ratio는 확신이 없으면 null로 두세요.\n" +
                    "형식: {\"transcript\": string, \"speech_rate_wpm\": number|null, \"silence_ratio\": number|null, \"observations\": string}",
                },
                { inline_data: { mime_type: "audio/webm", data: audioBuffer.toString("base64") } },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    const geminiJson = await geminiResp.json();
    if (!geminiResp.ok || geminiJson?.error) {
      throw new Error(geminiJson?.error?.message ?? `gemini request failed (${geminiResp.status})`);
    }
    const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // responseMimeType을 지정해도 가끔 ```json ... ``` 코드블록으로 감싸서 응답하는 경우가 있어 방어적으로 벗겨낸다
    const unfenced = text.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, "$1");

    let parsed: { transcript?: string; speech_rate_wpm?: number; silence_ratio?: number; observations?: string } = {};
    try {
      parsed = JSON.parse(unfenced);
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
        observations: parsed.observations ?? null,
      })
      .eq("id", voiceResponseId);

    await assessRiskForVoice(admin, voiceResponseId);
    res.status(200).json({ status: "ok" });
  } catch (err) {
    await admin.from("voice_response").update({ analysis_status: "failed" }).eq("id", voiceResponseId);
    await assessRiskForVoice(admin, voiceResponseId);
    res.status(200).json({ status: "failed", error: err instanceof Error ? err.message : String(err) });
  }
}
