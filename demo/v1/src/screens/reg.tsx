import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { BackButton } from "../components/BackButton";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { getErrorMessage } from "../lib/errors";
import { formatPhone } from "../lib/phone";

export const SCREEN_ID = "reg";

// 어르신 등록 — 최초 가입(계정 만들기 3/4)과 "어르신 추가"(1가족:N어르신) 양쪽에서 재사용.
// elderId가 있으면(=/guardian/elders/:elderId/edit) 등록이 아니라 기존 정보 수정 모드로 동작한다.
// 근거: 실사용 피드백 — "대상자 목록에서 어르신 정보를 수정할 방법이 없다"
// 성별 필드는 오픈 이슈(팀 최종 확인 대기)라 이번 패스에서는 노출하지 않는다.
export default function Reg() {
  const navigate = useNavigate();
  const location = useLocation();
  const { elderId } = useParams<{ elderId: string }>();
  const isEdit = Boolean(elderId);
  const fromSignup = Boolean((location.state as { fromSignup?: boolean } | null)?.fromSignup);

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");
  const [checkinTime, setCheckinTime] = useState("08:00");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingElder, setLoadingElder] = useState(isEdit);

  useEffect(() => {
    if (!isEdit || !supabaseConfigured) return;
    getSupabase()
      .from("elder_profile")
      .select("name,birth_date,relationship,phone,checkin_time")
      .eq("id", elderId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setError(getErrorMessage(error, "어르신 정보를 불러오지 못했습니다"));
        } else if (data) {
          setName(data.name ?? "");
          setBirthDate(data.birth_date ?? "");
          setRelationship(data.relationship ?? "");
          setPhone(data.phone ?? "");
          setCheckinTime(data.checkin_time?.slice(0, 5) ?? "08:00");
        }
        setLoadingElder(false);
      });
  }, [isEdit, elderId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabase();
      if (isEdit) {
        const { error } = await supabase
          .from("elder_profile")
          .update({
            name,
            birth_date: birthDate,
            relationship,
            phone: phone || null,
            checkin_time: checkinTime,
          })
          .eq("id", elderId);
        if (error) throw error;
        navigate(`/guardian/elders/${elderId}`);
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("로그인이 필요합니다");
      const { data, error } = await supabase
        .from("elder_profile")
        .insert({
          family_account_id: userData.user.id,
          name,
          birth_date: birthDate,
          relationship,
          phone: phone || null,
          checkin_time: checkinTime,
        })
        .select("id")
        .single();
      if (error) throw error;
      navigate(`/guardian/elders/${data.id}/conditions`, { state: { fromSignup } });
    } catch (err) {
      setError(getErrorMessage(err, isEdit ? "수정에 실패했습니다" : "어르신 등록에 실패했습니다"));
    } finally {
      setLoading(false);
    }
  }

  if (loadingElder) return <AppShell><p>불러오는 중...</p></AppShell>;

  return (
    <AppShell>
      <BackButton />
      <div className="g-header">{isEdit ? "어르신 정보 수정" : fromSignup ? "가족 · 계정 · 3 / 4" : "어르신 등록"}</div>
      <h1 className="g-title">어르신 정보</h1>
      <p className="g-sub">어르신이 직접 입력하지 않습니다.</p>
      <form onSubmit={handleSubmit}>
        <div className="g-field">
          <label>성함</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={10} required />
        </div>
        <div className="g-field">
          <label>생년월일</label>
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
        </div>
        <div className="g-field">
          <label>나와의 관계</label>
          <input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="예: 어머니" required />
        </div>
        <div className="g-field">
          <label>어르신 전화번호 (전화하기 버튼에 사용)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-0000-0000"
            maxLength={13}
          />
        </div>
        <div className="g-field">
          <label>안부 묻는 시각</label>
          <input type="time" value={checkinTime} onChange={(e) => setCheckinTime(e.target.value)} required />
        </div>
        {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
        <button className="g-button" type="submit" disabled={loading || !supabaseConfigured}>
          {loading ? "저장 중..." : isEdit ? "수정 완료" : "다음 — 지병 확인"}
        </button>
      </form>
    </AppShell>
  );
}
