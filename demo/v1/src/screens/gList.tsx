import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BrandLink } from "../components/BrandLink";
import { RiskDot, RiskPill } from "../components/RiskDot";
import { MedicalDisclaimer } from "../components/MedicalDisclaimer";
import { PushToggle } from "../components/PushToggle";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import type { RiskLevel } from "../config/riskConstants";
import { todaySeoul } from "../lib/date";

export const SCREEN_ID = "gList";

interface ElderRow {
  id: string;
  name: string;
  relationship: string;
  priority_status: RiskLevel;
}

type TodayStatus = "done" | "skipped" | "pending";

const LEVELS: RiskLevel[] = ["안전", "위험", "심각"];
const LEVEL_COLOR: Record<RiskLevel, string> = {
  안전: "var(--safe)",
  위험: "var(--warn)",
  심각: "var(--crit)",
};
// gAdmin.tsx와 동일한 정렬 기준 — 심각/위험이 있는 어르신이 위로 오게 해서
// 여러 어르신을 등록해둔 보호자가 목록에서 바로 확인할 수 있게 한다
const SEVERITY: Record<RiskLevel, number> = { 심각: 0, 위험: 1, 안전: 2 };
const TODAY_LABEL: Record<TodayStatus, string> = { done: "오늘 완료", skipped: "오늘 건너뜀", pending: "오늘 아직" };

// 요약 타일 왼쪽의 등급 색 띠 — CSS의 --stat-color로 넘긴다
const statStyle = (color: string) => ({ "--stat-color": color }) as CSSProperties;

export default function GList() {
  const navigate = useNavigate();
  const [elders, setElders] = useState<ElderRow[]>([]);
  const [todayStatus, setTodayStatus] = useState<Record<string, TodayStatus>>({});
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
      .then(async ({ data, error }) => {
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        const rows = (data ?? []) as ElderRow[];
        setElders(rows);
        setLoading(false);

        // 클릭해서 상세로 들어가지 않아도 오늘 안부 상태를 목록에서 바로 볼 수 있게.
        // 근거: 실사용 피드백 — "목록에서 한눈에 편하게 볼 수 있으면 좋겠다"
        const ids = rows.map((r) => r.id);
        if (ids.length === 0) return;
        const today = todaySeoul();
        const { data: checkins } = await supabase
          .from("daily_checkin")
          .select("elder_profile_id,skipped")
          .eq("date", today)
          .in("elder_profile_id", ids);
        const statusMap: Record<string, TodayStatus> = {};
        for (const c of checkins ?? []) {
          statusMap[c.elder_profile_id as string] = c.skipped ? "skipped" : "done";
        }
        setTodayStatus(statusMap);
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

  // 목록을 세지 않고도 오늘 상태가 한눈에 보이도록 위쪽에 등급별 인원을 먼저 놓는다
  const counts = Object.fromEntries(
    LEVELS.map((level) => [level, elders.filter((e) => e.priority_status === level).length])
  ) as Record<RiskLevel, number>;

  // gAdmin.tsx와 동일하게 심각/위험이 있는 어르신을 목록 위쪽으로 — 어르신이 여러 명이면
  // 매번 스크롤해서 찾지 않아도 바로 눈에 들어오게 한다
  const sorted = [...elders].sort((a, b) => {
    const levelDiff = SEVERITY[a.priority_status] - SEVERITY[b.priority_status];
    return levelDiff !== 0 ? levelDiff : a.name.localeCompare(b.name);
  });

  return (
    <AppShell
      aside={
        <>
          <BrandLink />
          <div className="g-aside-actions">
            {isAdmin && (
              <button className="g-back" onClick={() => navigate("/admin")}>
                관리자 대시보드
              </button>
            )}
            <button className="g-back" onClick={logout}>
              로그아웃
            </button>
            <PushToggle />
          </div>
          <div className="g-aside-foot">
            본 서비스는 의료기기가 아니며, 표시되는 위험도는 참고용 신호입니다.
            <div className="g-build">빌드 {__BUILD_ID__}</div>
          </div>
        </>
      }
    >
      <div className="g-toolbar">
        <div>
          <h1 className="g-title">대상자 목록</h1>
          <p className="g-sub">등록된 어르신 {elders.length}명의 오늘 상태입니다.</p>
        </div>
        <button className="g-button" onClick={() => navigate("/guardian/elders/new")}>
          어르신 추가
        </button>
      </div>

      {elders.length > 0 && (
        <div className="g-stats">
          {LEVELS.map((level) => (
            <div key={level} className="g-stat" style={statStyle(LEVEL_COLOR[level])}>
              <div className="g-stat-label">{level}</div>
              <div className="g-stat-value">
                {counts[level]}
                <small>명</small>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="g-error">{error}</p>}
      {loading && <p className="g-sub">불러오는 중...</p>}
      {!loading && elders.length === 0 && !error && (
        <p className="g-sub">등록된 어르신이 없습니다. 어르신을 추가해보세요.</p>
      )}

      {elders.length > 0 && (
        <div className="g-card">
          <div className="g-card-title">
            <span>대상자</span>
          </div>
          {sorted.map((elder) => {
            const status = todayStatus[elder.id] ?? "pending";
            return (
            <button
              key={elder.id}
              className="g-list-item"
              onClick={() => navigate(`/guardian/elders/${elder.id}`)}
            >
              <RiskDot level={elder.priority_status} />
              <div className="g-list-body">
                <div className="g-list-name">{elder.name}</div>
                <div className="g-list-meta">
                  {elder.relationship}
                  <span className={`g-today-badge g-today-badge--${status}`}>{TODAY_LABEL[status]}</span>
                </div>
              </div>
              <RiskPill level={elder.priority_status} />
              <span
                role="button"
                className="g-rowaction"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/guardian/elders/${elder.id}/edit`);
                }}
              >
                수정
              </span>
              <span
                role="button"
                className="g-rowaction g-rowaction--danger"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteElder(elder);
                }}
              >
                삭제
              </span>
              <span className="g-chev">›</span>
            </button>
            );
          })}
        </div>
      )}

      <MedicalDisclaimer />
    </AppShell>
  );
}
