import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BackButton } from "../components/BackButton";
import { RiskDot } from "../components/RiskDot";
import { MedicalDisclaimer } from "../components/MedicalDisclaimer";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { getErrorMessage } from "../lib/errors";
import type { RiskLevel } from "../config/riskConstants";

export const SCREEN_ID = "gAdmin";

const SEVERITY: Record<RiskLevel, number> = { 심각: 0, 위험: 1, 안전: 2 };

interface ElderRow {
  id: string;
  name: string;
  relationship: string;
  priority_status: RiskLevel;
  family_account: { email: string } | null;
}

interface RiskRow {
  elder_profile_id: string;
  level: RiskLevel;
  reason: string;
  date: string;
}

export default function GAdmin() {
  const navigate = useNavigate();
  const [access, setAccess] = useState<"checking" | "ok" | "denied">("checking");
  const [elders, setElders] = useState<ElderRow[]>([]);
  const [riskByElder, setRiskByElder] = useState<Record<string, RiskRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setAccess("denied");
      return;
    }
    const supabase = getSupabase();

    supabase.rpc("is_admin").then(({ data }) => {
      if (!data) {
        setAccess("denied");
        return;
      }
      setAccess("ok");

      Promise.all([
        supabase
          .from("elder_profile")
          .select("id,name,relationship,priority_status,family_account:family_account_id(email)"),
        supabase
          .from("risk_assessment")
          .select("elder_profile_id,level,reason,date")
          .order("date", { ascending: false }),
      ])
        .then(([eldersRes, riskRes]) => {
          if (eldersRes.error) throw eldersRes.error;
          if (riskRes.error) throw riskRes.error;

          const latestRisk: Record<string, RiskRow> = {};
          for (const row of (riskRes.data ?? []) as RiskRow[]) {
            if (!latestRisk[row.elder_profile_id]) latestRisk[row.elder_profile_id] = row;
          }
          setRiskByElder(latestRisk);
          setElders((eldersRes.data ?? []) as unknown as ElderRow[]);
        })
        .catch((err) => setError(getErrorMessage(err, "데이터를 불러오지 못했습니다")))
        .finally(() => setLoading(false));
    });
  }, []);

  if (access === "checking") return null;
  if (access === "denied") return <AppShell><p style={{ color: "var(--red)" }}>관리자 권한이 없습니다.</p></AppShell>;

  const sorted = [...elders].sort((a, b) => {
    const levelDiff = SEVERITY[a.priority_status] - SEVERITY[b.priority_status];
    return levelDiff !== 0 ? levelDiff : a.name.localeCompare(b.name);
  });
  const counts = elders.reduce(
    (acc, e) => ({ ...acc, [e.priority_status]: (acc[e.priority_status] ?? 0) + 1 }),
    {} as Record<RiskLevel, number>
  );

  return (
    <AppShell>
      <BackButton to="/guardian" />
      <div className="g-header">관리자 대시보드</div>
      <h1 className="g-title">전체 현황</h1>
      <p className="g-sub">전체 가족의 데이터를 읽기 전용으로 모니터링합니다.</p>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <div style={{ flex: 1, background: "var(--mist)", borderRadius: 12, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{elders.length}</div>
          <div style={{ fontSize: 12, color: "var(--ink3)" }}>전체</div>
        </div>
        <div style={{ flex: 1, background: "var(--mist)", borderRadius: 12, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)" }}>{counts["위험"] ?? 0}</div>
          <div style={{ fontSize: 12, color: "var(--ink3)" }}>위험</div>
        </div>
        <div style={{ flex: 1, background: "var(--mist)", borderRadius: 12, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--red)" }}>{counts["심각"] ?? 0}</div>
          <div style={{ fontSize: 12, color: "var(--ink3)" }}>심각</div>
        </div>
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
      {!loading && sorted.length === 0 && !error && <p className="g-sub">등록된 어르신이 없습니다.</p>}

      {sorted.map((elder) => {
        const risk = riskByElder[elder.id];
        return (
          <button key={elder.id} className="g-list-item" onClick={() => navigate(`/guardian/elders/${elder.id}`)}>
            <RiskDot level={elder.priority_status} />
            <div style={{ flex: 1 }}>
              <div className="g-list-name">{elder.name} <span style={{ fontSize: 12, color: "var(--ink3)" }}>{elder.relationship}</span></div>
              <div className="g-list-meta">보호자: {elder.family_account?.email ?? "알 수 없음"}</div>
              {risk && <div className="g-list-meta">{risk.reason}</div>}
            </div>
            <span style={{ color: "var(--ink3)" }}>›</span>
          </button>
        );
      })}

      <MedicalDisclaimer />
    </AppShell>
  );
}
