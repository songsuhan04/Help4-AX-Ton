import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BackButton } from "../components/BackButton";
import { Chip } from "../components/Chip";
import { CONDITION_CATEGORIES, CONDITIONS, buildDailyQuestions, getConditionsByCategory } from "../domain/conditions";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { getErrorMessage } from "../lib/errors";
import { ConsentItem } from "../components/ConsentItem";

export const SCREEN_ID = "cond";

export default function Cond() {
  const { elderId } = useParams<{ elderId: string }>();
  const location = useLocation();
  const fromSignup = Boolean((location.state as { fromSignup?: boolean } | null)?.fromSignup);
  const navigate = useNavigate();

  const [selected, setSelected] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [consentHealth, setConsentHealth] = useState(false);
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
          <div className="g-header">{category}</div>
          {getConditionsByCategory(category).map((c) => (
            <Chip key={c.id} label={c.label} selected={selected.includes(c.id)} onClick={() => toggle(c.id)} />
          ))}
        </div>
      ))}

      <div className="g-field">
        <label>직접 입력 (목록에 없는 경우)</label>
        <input value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="예: 갑상선 질환" />
      </div>

      <div className="g-card" style={{ marginBottom: 16 }}>
        <div className="g-card-title">
          <span>오늘 어르신께 물을 질문 {preview.length}개</span>
        </div>
        <ol className="g-questions">
          {preview.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ol>
        {riskNotes.length > 0 && (
          <div className="g-note">
            {riskNotes.map((c) => (
              <div key={c.id}>· {c.label} — {c.riskNote}</div>
            ))}
          </div>
        )}
      </div>

      {/* 개인정보보호법 §23 대응 — 건강정보는 민감정보라 일반 개인정보 동의와 별도로
          받아야 하고, 보호자가 어르신을 대신해 입력하므로 대리 동의 확인 문구도 필요하다.
          근거: Help4/법적문제 피해가기 공략.pdf §1, 체크리스트 1번
          ⚠️ 예전에는 지병을 하나도 고르지 않으면 이 동의를 건너뛸 수 있게 해뒀는데, 근거 문서가
          "지병 정보 및 매일 응답하는 안부 체크리스트 데이터"를 모두 민감정보로 규정하고 있어
          잘못된 처리였다. 안부 응답은 지병 입력 여부와 무관하게 항상 수집되므로 항상 필수다. */}
      <ConsentItem
        checked={consentHealth}
        onChange={setConsentHealth}
        label="(필수) 건강 관련 민감정보 수집·이용에 동의합니다"
        detail={
          <>
            <div>수집 항목: 지병명(사전 정의 목록 또는 직접 입력), 매일의 안부 체크 응답(복약·식사·외출·몸 상태 등), 말하기 안부 음성</div>
            <div>수집 목적: 지병에 맞춘 안부 질문 생성, 위험도 산정 시 가중치 반영</div>
            <div>보유 기간: 어르신 등록 해제 시까지</div>
            <div>대리 입력: 보호자가 어르신을 대신하여 입력하며, 어르신 본인의 사전 동의를 받았음을 전제로 합니다.</div>
            <div>동의를 거부할 권리가 있으나, 안부 응답 자체가 건강에 관한 정보에 해당하므로 동의하지 않으면 서비스를 이용할 수 없습니다.</div>
          </>
        }
      />

      {error && <p className="g-error">{error}</p>}
      <button className="g-button" onClick={handleSubmit} disabled={loading || !consentHealth || !supabaseConfigured}>
        {loading ? "저장 중..." : "저장하고 초대하기"}
      </button>
    </AppShell>
  );
}
