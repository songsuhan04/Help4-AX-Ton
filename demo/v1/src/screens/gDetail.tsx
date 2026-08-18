import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BackButton } from "../components/BackButton";
import { RiskDot } from "../components/RiskDot";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import type { RiskLevel } from "../config/riskConstants";

export const SCREEN_ID = "gDetail";

interface ElderDetail {
  id: string;
  name: string;
  relationship: string;
  priority_status: RiskLevel;
}

interface RiskRow {
  reason: string;
  level: RiskLevel;
}

export default function GDetail() {
  const { elderId } = useParams<{ elderId: string }>();
  const navigate = useNavigate();
  const [elder, setElder] = useState<ElderDetail | null>(null);
  const [risk, setRisk] = useState<RiskRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured || !elderId) return;
    const supabase = getSupabase();
    supabase
      .from("elder_profile")
      .select("id,name,relationship,priority_status")
      .eq("id", elderId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setElder(data as ElderDetail);
      });
    supabase
      .from("risk_assessment")
      .select("reason,level")
      .eq("elder_profile_id", elderId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setRisk((data as RiskRow) ?? null));
  }, [elderId]);

  async function markChecked() {
    setBusy(true);
    await getSupabase()
      .from("risk_assessment")
      .update({ family_action: "확인함" })
      .eq("elder_profile_id", elderId)
      .order("date", { ascending: false })
      .limit(1);
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
        <button className="g-button" disabled={busy} style={{ flex: 1 }}>전화하기</button>
        <button className="g-button g-button--secondary" disabled={busy} onClick={markChecked} style={{ flex: 1 }}>
          확인했어요
        </button>
      </div>

      <button className="g-button g-button--secondary" style={{ marginTop: 16 }} onClick={() => navigate(`/guardian/elders/${elderId}/letter`)}>
        영상편지 보내기
      </button>
      <button className="g-button g-button--secondary" onClick={reinvite} disabled={busy}>
        재초대 (기기 변경 시)
      </button>
    </AppShell>
  );
}
