import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { SpeakButton } from "../components/SpeakButton";
import { ProgressBar } from "../components/ProgressBar";
import { DisplaySettings } from "../components/DisplaySettings";
import { getStoredElderProfileId } from "../lib/elderSession";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { todaySeoul } from "../lib/date";
import { fetchDailyPrompt } from "../lib/dailyPrompt";

export const SCREEN_ID = "eCheck";

type Category = "medication" | "meal" | "outing" | "mood" | "condition" | "other";
type Severity = "ok" | "warn" | "danger";

interface GeneratedOption {
  text: string;
  severity: Severity;
}

interface GeneratedQuestion {
  question: string;
  category: Category;
  options: GeneratedOption[];
}

// lib/riskScoring.ts가 위험도 계산에 쓰는 구조화된 응답 신호. 근거: 기능설계서.md §3, plan "P0"
interface AnsweredQuestion {
  question: string;
  category: Category;
  choice: string;
  severity: Severity;
}


export default function ECheck() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    const elderId = getStoredElderProfileId();
    const supabase = getSupabase();

    async function load() {
      // 새벽 크론이 미리 만들어둔 것이 있으면 그걸 쓴다 — AI 호출을 기다리지 않는다.
      // 근거: 실사용 피드백 — "버퍼링이 걸리더라"
      // 즉석 생성한 질문도 여기에 저장되므로, 새로고침해도 같은 질문이 나온다.
      const prepared = await fetchDailyPrompt(elderId!, todaySeoul());
      if (prepared?.questions && prepared.questions.length > 0) {
        setQuestions(prepared.questions as GeneratedQuestion[]);
        setLoading(false);
        return;
      }

      const [{ data: conditionRows }, { data: recentRows }] = await Promise.all([
        supabase.from("elder_condition").select("condition_type").eq("elder_profile_id", elderId),
        supabase
          .from("daily_checkin")
          .select("questions")
          .eq("elder_profile_id", elderId)
          .order("date", { ascending: false })
          .limit(3),
      ]);

      const conditions = (conditionRows ?? []).map((r) => r.condition_type as string);
      const recentQuestions = (recentRows ?? [])
        .flatMap((r) => ((r.questions as GeneratedQuestion[]) ?? []).map((q) => q.question))
        .slice(0, 12);

      let generated: GeneratedQuestion[] = [];
      try {
        const resp = await fetch("/api/generate-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conditions, recentQuestions, elderProfileId: elderId, date: todaySeoul() }),
        });
        const json = await resp.json();
        generated = json.questions ?? [];
      } catch {
        // 네트워크 실패 시에도 화면이 멈추지 않도록 최소 문항으로 진행
        generated = [
          {
            question: "오늘 별일 없으셨어요?",
            category: "other",
            options: [
              { text: "네, 괜찮아요", severity: "ok" },
              { text: "조금 힘들었어요", severity: "warn" },
            ],
          },
        ];
      }

      // 여기서 daily_checkin에 행을 만들지 않는다. 예전에는 새로고침 대비로 질문을 미리
      // 저장했는데, 그러면 어르신이 아무것도 답하지 않았는데 그날 행이 생긴다. 보호자 목록·
      // 위험도 계산·무응답 알림이 모두 "행이 있으면 응답한 것"으로 보기 때문에, 화면만 열고
      // 나간 어르신이 "오늘 완료"로 보이고 무응답 알림까지 막혔다.
      // 질문은 서버가 daily_prompt에 저장한다(api/generate-questions.ts).
      setQuestions(generated);
      setLoading(false);
    }

    load();
  }, []);

  // 문항 중간이면 이전 문항으로(잘못 고른 답을 고치도록), 첫 문항이면 설문 진입 전
  // 화면으로 나간다. 근거: 실사용 피드백 — "설문할 때 뒤로가기 버튼이 없어졌어"
  function goBack() {
    if (index > 0) {
      setAnswers((prev) => prev.slice(0, -1));
      setIndex((i) => i - 1);
    } else {
      navigate(-1);
    }
  }

  function answer(option: GeneratedOption) {
    const question = questions[index];
    const next = [
      ...answers,
      { question: question.question, category: question.category, choice: option.text, severity: option.severity },
    ];
    setAnswers(next);
    if (index + 1 < questions.length) {
      setIndex(index + 1);
    } else {
      finish(next);
    }
  }

  async function finish(finalAnswers: AnsweredQuestion[]) {
    const elderId = getStoredElderProfileId();
    const date = todaySeoul();
    await getSupabase()
      .from("daily_checkin")
      .upsert(
        { elder_profile_id: elderId, date, answers: finalAnswers, skipped: false, questions },
        { onConflict: "elder_profile_id,date" }
      );
    // 위험도 계산은 fire-and-forget — 실패해도 하루 기록은 이미 저장되어 있다
    fetch("/api/assess-risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ elderProfileId: elderId, date }),
    }).catch(() => {});
    navigate("/elder/speech");
  }

  if (loading) return <AppShell variant="elder"><p className="e-lead">오늘의 안부를 준비하고 있어요...</p></AppShell>;
  const question = questions[index];
  if (!question) return <AppShell variant="elder"><p className="e-lead">준비된 질문이 없습니다.</p></AppShell>;

  return (
    <AppShell variant="elder">
      <button className="e-back" onClick={goBack}>
        ← 이전
      </button>
      <div className="e-topbar">
        <DisplaySettings />
        <span className="e-brand">Callog</span>
      </div>
      <ProgressBar current={index + 1} total={questions.length} />
      <h1 className="e-question">{question.question}</h1>
      <SpeakButton text={question.question} />

      {question.options.map((option) => (
        <button key={option.text} className="e-choice" onClick={() => answer(option)}>
          {option.text}
        </button>
      ))}
    </AppShell>
  );
}
