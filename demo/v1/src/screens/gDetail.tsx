import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BackButton } from "../components/BackButton";
import { RiskDot } from "../components/RiskDot";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { getSignedUrl } from "../lib/storage";
import type { RiskLevel } from "../config/riskConstants";

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

export default function GDetail() {
  const { elderId } = useParams<{ elderId: string }>();
  const navigate = useNavigate();
  const [elder, setElder] = useState<ElderDetail | null>(null);
  const [risk, setRisk] = useState<RiskRow | null>(null);
  const [letters, setLetters] = useState<LetterRow[]>([]);
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
    await getSupabase().rpc("revoke_elder_access", { p_elder: elderId });
    setBusy(false);
    navigate(`/guardian/elders/${elderId}/invite`);
  }

  if (!elder) return <AppShell>{error ? <p style={{ color: "var(--red)" }}>{error}</p> : <p>불러오는 중...</p>}</AppShell>;

  return (
    <AppShell>
      <BackButton to="/guardian" />
      <div className="g-header" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <RiskDot level={elder.priority_status} /> {elder.priority_status}
      </div>
      <h1 className="g-title">{elder.name} <span style={{ fontSize: 14, color: "var(--ink3)" }}>{elder.relationship}</span></h1>

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

      <div style={{ marginTop: 24 }}>
        <div className="g-header">{elder.name}님이 보낸 영상편지</div>
        {letters.length === 0 && <p className="g-sub">아직 받은 영상편지가 없습니다.</p>}
        {letters.map((letter) => (
          <div key={letter.id} style={{ background: "var(--mist)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 6 }}>
              {new Date(letter.sent_at).toLocaleString("ko-KR")}
            </div>
            <div style={{ marginBottom: 8 }}>{letter.title}</div>
            {letter.signedUrl && <video src={letter.signedUrl} controls style={{ width: "100%", borderRadius: 8 }} />}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
