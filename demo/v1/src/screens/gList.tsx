import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { RiskDot } from "../components/RiskDot";
import { MedicalDisclaimer } from "../components/MedicalDisclaimer";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import type { RiskLevel } from "../config/riskConstants";

export const SCREEN_ID = "gList";

interface ElderRow {
  id: string;
  name: string;
  relationship: string;
  priority_status: RiskLevel;
}

export default function GList() {
  const navigate = useNavigate();
  const [elders, setElders] = useState<ElderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    supabase
      .from("elder_profile")
      .select("id,name,relationship,priority_status")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setElders((data ?? []) as ElderRow[]);
        setLoading(false);
      });
    supabase.rpc("is_admin").then(({ data }) => setIsAdmin(Boolean(data)));
  }, []);

  async function logout() {
    await getSupabase().auth.signOut();
    navigate("/");
  }

  async function deleteElder(elder: ElderRow) {
    if (!window.confirm(`${elder.name}님을 목록에서 삭제할까요? 관련된 안부 기록·영상편지·위험도 이력이 모두 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    const { error } = await getSupabase().from("elder_profile").delete().eq("id", elder.id);
    if (error) {
      setError(error.message);
      return;
    }
    setElders((prev) => prev.filter((e) => e.id !== elder.id));
  }

  return (
    <AppShell>
      <div className="g-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Callog(콜록)</span>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin && (
            <button className="g-back" onClick={() => navigate("/admin")}>
              관리자 대시보드
            </button>
          )}
          <button className="g-back" onClick={logout}>
            로그아웃
          </button>
        </div>
      </div>
      <h1 className="g-title">대상자 목록</h1>

      {loading && <p>불러오는 중...</p>}
      {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
      {!loading && elders.length === 0 && !error && (
        <p className="g-sub">등록된 어르신이 없습니다. 어르신을 추가해보세요.</p>
      )}

      {elders.map((elder) => (
        <button key={elder.id} className="g-list-item" onClick={() => navigate(`/guardian/elders/${elder.id}`)}>
          <RiskDot level={elder.priority_status} />
          <div style={{ flex: 1 }}>
            <div className="g-list-name">{elder.name}</div>
            <div className="g-list-meta">{elder.relationship}</div>
          </div>
          <span
            role="button"
            style={{ color: "var(--ink3)", fontSize: 13, padding: "4px 8px" }}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/guardian/elders/${elder.id}/edit`);
            }}
          >
            수정
          </span>
          <span
            role="button"
            style={{ color: "var(--red)", fontSize: 13, padding: "4px 8px" }}
            onClick={(e) => {
              e.stopPropagation();
              deleteElder(elder);
            }}
          >
            삭제
          </span>
          <span style={{ color: "var(--ink3)" }}>›</span>
        </button>
      ))}

      <button className="g-button" style={{ marginTop: 20 }} onClick={() => navigate("/guardian/elders/new")}>
        어르신 추가
      </button>

      <MedicalDisclaimer />
    </AppShell>
  );
}
