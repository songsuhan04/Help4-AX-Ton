import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { RiskDot } from "../components/RiskDot";
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

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    getSupabase()
      .from("elder_profile")
      .select("id,name,relationship,priority_status")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setElders((data ?? []) as ElderRow[]);
        setLoading(false);
      });
  }, []);

  return (
    <AppShell>
      <div className="g-header">Callog(콜록)</div>
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
          <span style={{ color: "var(--ink3)" }}>›</span>
        </button>
      ))}

      <button className="g-button" style={{ marginTop: 20 }} onClick={() => navigate("/guardian/elders/new")}>
        어르신 추가
      </button>
    </AppShell>
  );
}
