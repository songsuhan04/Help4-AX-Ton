import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BackButton } from "../components/BackButton";
import { RiskDot } from "../components/RiskDot";
import { TrendChart, type TrendPoint } from "../components/TrendChart";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { getSignedUrl, deleteFromBucket } from "../lib/storage";
import { getRpcErrorMessage } from "../lib/errors";
import { computeStreak } from "../lib/streak";
import type { RiskLevel } from "../config/riskConstants";

const TREND_DAYS = 14;

export const SCREEN_ID = "gDetail";

interface ElderDetail {
  id: string;
  name: string;
  relationship: string;
  phone: string | null;
  priority_status: RiskLevel;
}

interface RiskRow {
  reason: string;
  level: RiskLevel;
  date: string;
}

interface LetterRow {
  id: string;
  title: string;
  video_url: string;
  sent_at: string;
  signedUrl?: string;
}

interface VoiceRow {
  id: string;
  audio_url: string;
  created_at: string;
  transcript: string | null;
  observations: string | null;
  analysis_status: string;
  signedUrl?: string;
}

export default function GDetail() {
  const { elderId } = useParams<{ elderId: string }>();
  const navigate = useNavigate();
  const [elder, setElder] = useState<ElderDetail | null>(null);
  const [risk, setRisk] = useState<RiskRow | null>(null);
  const [letters, setLetters] = useState<LetterRow[]>([]);
  const [myLetters, setMyLetters] = useState<LetterRow[]>([]);
  const [voice, setVoice] = useState<VoiceRow | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [streak, setStreak] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured || !elderId) return;
    const supabase = getSupabase();
    supabase
      .from("elder_profile")
      .select("id,name,relationship,phone,priority_status")
      .eq("id", elderId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setElder(data as ElderDetail);
      });
    supabase
      .from("risk_assessment")
      .select("reason,level,date")
      .eq("elder_profile_id", elderId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setRisk((data as RiskRow) ?? null));
    // 어르신이 보낸 영상편지 — 보호자도 확인할 수 있어야 함
    supabase
      .from("video_letter")
      .select("id,title,video_url,sent_at")
      .eq("sender_type", "elder")
      .eq("sender_id", elderId)
      .order("sent_at", { ascending: false })
      .then(async ({ data }) => {
        const rows = (data ?? []) as LetterRow[];
        const withUrls = await Promise.all(
          rows.map(async (row) => ({ ...row, signedUrl: await getSignedUrl("letters", row.video_url).catch(() => undefined) }))
        );
        setLetters(withUrls);
      });
    // 내가(보호자) 보낸 영상편지 — 잘못 보낸 걸 확인하고 지울 수 있어야 함
    supabase.auth.getUser().then(async ({ data: userData }) => {
      if (!userData.user) return;
      const { data } = await supabase
        .from("video_letter")
        .select("id,title,video_url,sent_at")
        .eq("sender_type", "family")
        .eq("sender_id", userData.user.id)
        .eq("receiver_id", elderId)
        .order("sent_at", { ascending: false });
      const rows = (data ?? []) as LetterRow[];
      const withUrls = await Promise.all(
        rows.map(async (row) => ({ ...row, signedUrl: await getSignedUrl("letters", row.video_url).catch(() => undefined) }))
      );
      setMyLetters(withUrls);
    });
    // 최근 말하기 안부 음성 — 보호자도 직접 들을 수 있어야 함
    supabase
      .from("daily_checkin")
      .select("id")
      .eq("elder_profile_id", elderId)
      .order("date", { ascending: false })
      .limit(7)
      .then(async ({ data: checkins }) => {
        const ids = (checkins ?? []).map((c) => c.id);
        if (ids.length === 0) return;
        const { data } = await supabase
          .from("voice_response")
          .select("id,audio_url,created_at,transcript,observations,analysis_status")
          .in("daily_checkin_id", ids)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!data) return;
        const signedUrl = await getSignedUrl("voice", data.audio_url).catch(() => undefined);
        setVoice({ ...(data as VoiceRow), signedUrl });
      });
    // 최근 위험도 추이 — 기능설계서.md §1 "꺾은선 그래프 기록"
    const days: string[] = [];
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    supabase
      .from("risk_assessment")
      .select("date,level")
      .eq("elder_profile_id", elderId)
      .gte("date", days[0])
      .then(({ data }) => {
        const byDate = new Map((data ?? []).map((r) => [r.date as string, r.level as RiskLevel]));
        setTrend(days.map((date) => ({ date, level: byDate.get(date) ?? null })));
      });
    // 연속 참여 기록 — 기능설계서.md §1 "연속 참여 기록"
    supabase
      .from("daily_checkin")
      .select("date")
      .eq("elder_profile_id", elderId)
      .eq("skipped", false)
      .order("date", { ascending: false })
      .limit(400)
      .then(({ data }) => setStreak(computeStreak((data ?? []).map((r) => r.date as string))));
  }, [elderId]);

  async function markChecked() {
    if (!risk) return;
    setBusy(true);
    // order()/limit()은 update에는 적용되지 않아 date로 직접 특정 행만 지정해야 한다
    await getSupabase()
      .from("risk_assessment")
      .update({ family_action: "확인함" })
      .eq("elder_profile_id", elderId)
      .eq("date", risk.date);
    setBusy(false);
  }

  async function reinvite() {
    setBusy(true);
    const { error } = await getSupabase().rpc("revoke_elder_access", { p_elder: elderId });
    setBusy(false);
    if (error) {
      setError(getRpcErrorMessage(error, "재초대에 실패했습니다"));
      return;
    }
    navigate(`/guardian/elders/${elderId}/invite`);
  }

  async function deleteLetter(letter: LetterRow, from: "elder" | "family") {
    if (!window.confirm("이 영상편지를 삭제할까요? 되돌릴 수 없습니다.")) return;
    await deleteFromBucket("letters", letter.video_url).catch(() => {});
    await getSupabase().from("video_letter").delete().eq("id", letter.id);
    const setter = from === "elder" ? setLetters : setMyLetters;
    setter((prev) => prev.filter((l) => l.id !== letter.id));
  }

  if (!elder) return <AppShell>{error ? <p style={{ color: "var(--red)" }}>{error}</p> : <p>불러오는 중...</p>}</AppShell>;

  return (
    <AppShell>
      <BackButton to="/guardian" />
      <div className="g-header" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <RiskDot level={elder.priority_status} /> {elder.priority_status}
      </div>
      <h1 className="g-title">{elder.name} <span style={{ fontSize: 14, color: "var(--ink3)" }}>{elder.relationship}</span></h1>

      {streak > 0 && <p className="g-sub">{streak}일 연속 안부를 남기고 있어요</p>}
      {risk ? <p className="g-sub">{risk.reason}</p> : <p className="g-sub">특별한 위험 신호가 없습니다.</p>}

      <div style={{ display: "flex", gap: 8 }}>
        {elder.phone ? (
          <a
            className="g-button"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
            href={`tel:${elder.phone}`}
          >
            전화하기
          </a>
        ) : (
          <button className="g-button" disabled style={{ flex: 1 }} title="등록된 전화번호가 없습니다">
            전화하기
          </button>
        )}
        <button className="g-button g-button--secondary" disabled={busy || !risk} onClick={markChecked} style={{ flex: 1 }}>
          확인했어요
        </button>
      </div>

      <button className="g-button g-button--secondary" style={{ marginTop: 16 }} onClick={() => navigate(`/guardian/elders/${elderId}/letter`)}>
        영상편지 보내기
      </button>
      <button className="g-button g-button--secondary" onClick={reinvite} disabled={busy}>
        재초대 (기기 변경 시)
      </button>
      {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}

      {trend.some((p) => p.level) && (
        <div style={{ marginTop: 24 }}>
          <div className="g-header">최근 {TREND_DAYS}일 추이</div>
          <TrendChart points={trend} />
        </div>
      )}

      {voice?.signedUrl && (
        <div style={{ marginTop: 24 }}>
          <div className="g-header">최근 말하기 안부</div>
          <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 6 }}>
            {new Date(voice.created_at).toLocaleString("ko-KR")}
          </div>
          <audio src={voice.signedUrl} controls style={{ width: "100%" }} />
          {voice.analysis_status === "failed" && (
            <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>음성 분석에 실패했습니다. 직접 들어보고 확인해주세요.</p>
          )}
          {voice.analysis_status === "ok" && (voice.transcript || voice.observations) && (
            <div style={{ background: "var(--mist)", borderRadius: 12, padding: 12, marginTop: 8, fontSize: 14 }}>
              {voice.transcript && (
                <div style={{ marginBottom: voice.observations ? 6 : 0 }}>
                  <span style={{ color: "var(--ink3)" }}>말씀 내용: </span>{voice.transcript}
                </div>
              )}
              {voice.observations && (
                <div>
                  <span style={{ color: "var(--ink3)" }}>AI 소견: </span>{voice.observations}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <div className="g-header">{elder.name}님이 보낸 영상편지</div>
        {letters.length === 0 && <p className="g-sub">아직 받은 영상편지가 없습니다.</p>}
        {letters.map((letter) => (
          <div key={letter.id} style={{ background: "var(--mist)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 6 }}>
              {new Date(letter.sent_at).toLocaleString("ko-KR")}
            </div>
            <div style={{ marginBottom: 8 }}>{letter.title}</div>
            {letter.signedUrl && <video src={letter.signedUrl} controls style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />}
            <button className="g-button g-button--secondary" onClick={() => deleteLetter(letter, "elder")}>
              삭제
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <div className="g-header">내가 보낸 영상편지</div>
        {myLetters.length === 0 && <p className="g-sub">아직 보낸 영상편지가 없습니다.</p>}
        {myLetters.map((letter) => (
          <div key={letter.id} style={{ background: "var(--mist)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 6 }}>
              {new Date(letter.sent_at).toLocaleString("ko-KR")}
            </div>
            <div style={{ marginBottom: 8 }}>{letter.title}</div>
            {letter.signedUrl && <video src={letter.signedUrl} controls style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />}
            <button className="g-button g-button--secondary" onClick={() => deleteLetter(letter, "family")}>
              삭제
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
