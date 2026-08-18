import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BackButton } from "../components/BackButton";
import { Chip } from "../components/Chip";
import { CONDITION_CATEGORIES, CONDITIONS, buildDailyQuestions, getConditionsByCategory } from "../domain/conditions";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { getErrorMessage } from "../lib/errors";

export const SCREEN_ID = "cond";

export default function Cond() {
  const { elderId } = useParams<{ elderId: string }>();
  const location = useLocation();
  const fromSignup = Boolean((location.state as { fromSignup?: boolean } | null)?.fromSignup);
  const navigate = useNavigate();

  const [selected, setSelected] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const preview = buildDailyQuestions(selected);
  const riskNotes = CONDITIONS.filter((c) => selected.includes(c.id) && c.riskNote);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabase();
      const rows = selected.map((id) => ({ elder_profile_id: elderId, condition_type: id }));
      if (customText.trim()) rows.push({ elder_profile_id: elderId!, condition_type: "custom", custom_text: customText.trim() } as never);
      if (rows.length > 0) {
        const { error } = await supabase.from("elder_condition").insert(rows);
        if (error) throw error;
      }
      navigate(`/guardian/elders/${elderId}/invite`);
    } catch (err) {
      setError(getErrorMessage(err, "지병 저장에 실패했습니다"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <BackButton />
      <div className="g-header">{fromSignup ? "가족 · 계정 · 4 / 4" : "지병 선택"}</div>
      <h1 className="g-title">앓고 계신 병을 골라주세요</h1>
      <p className="g-sub">고른 병에 따라 질문이 달라지고, 같은 대답의 무게도 달라집니다.</p>

      {CONDITION_CATEGORIES.map((category) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 8 }}>{category}</div>
          {getConditionsByCategory(category).map((c) => (
            <Chip key={c.id} label={c.label} selected={selected.includes(c.id)} onClick={() => toggle(c.id)} />
          ))}
        </div>
      ))}

      <div className="g-field">
        <label>직접 입력 (목록에 없는 경우)</label>
        <input value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="예: 갑상선 질환" />
      </div>

      <div style={{ background: "var(--mist)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 8 }}>오늘 어르신께 물을 질문 {preview.length}개</div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
          {preview.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ol>
        {riskNotes.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 13, color: "var(--ink2)" }}>
            {riskNotes.map((c) => (
              <div key={c.id}>· {c.label} — {c.riskNote}</div>
            ))}
          </div>
        )}
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
      <button className="g-button" onClick={handleSubmit} disabled={loading || !supabaseConfigured}>
        {loading ? "저장 중..." : "저장하고 초대하기"}
      </button>
    </AppShell>
  );
}
