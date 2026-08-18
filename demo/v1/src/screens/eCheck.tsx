import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { SpeakButton } from "../components/SpeakButton";
import { ProgressBar } from "../components/ProgressBar";
import { FontSizeToggle } from "../components/FontSizeToggle";
import { getStoredElderProfileId } from "../lib/elderSession";
import { getSupabase, supabaseConfigured } from "../lib/supabase";

export const SCREEN_ID = "eCheck";

interface GeneratedQuestion {
  question: string;
  options: string[];
}

const today = () => new Date().toISOString().slice(0, 10);

export default function ECheck() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
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
      // 오늘 이미 생성된 질문이 있으면 그대로 재사용(새로고침해도 같은 질문 유지)
      const { data: existing } = await supabase
        .from("daily_checkin")
        .select("questions")
        .eq("elder_profile_id", elderId)
        .eq("date", today())
        .maybeSingle();

      if (existing?.questions) {
        setQuestions(existing.questions as GeneratedQuestion[]);
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
          body: JSON.stringify({ conditions, recentQuestions }),
        });
        const json = await resp.json();
        generated = json.questions ?? [];
      } catch {
        // 네트워크 실패 시에도 화면이 멈추지 않도록 최소 문항으로 진행
        generated = [{ question: "오늘 별일 없으셨어요?", options: ["네, 괜찮아요", "조금 힘들었어요"] }];
      }

      setQuestions(generated);
      // 다음에 새로고침해도 같은 질문 유지되도록 미리 저장
      await supabase
        .from("daily_checkin")
        .upsert(
          { elder_profile_id: elderId, date: today(), questions: generated },
          { onConflict: "elder_profile_id,date" }
        );
      setLoading(false);
    }

    load();
  }, []);

  function answer(choice: string) {
    const question = questions[index];
    const next = { ...answers, [question.question]: choice };
    setAnswers(next);
    if (index + 1 < questions.length) {
      setIndex(index + 1);
    } else {
      finish(next);
    }
  }

  async function finish(finalAnswers: Record<string, string>) {
    const elderId = getStoredElderProfileId();
    await getSupabase()
      .from("daily_checkin")
      .upsert(
        { elder_profile_id: elderId, date: today(), answers: finalAnswers, skipped: false, questions },
        { onConflict: "elder_profile_id,date" }
      );
    navigate("/elder/speech");
  }

  if (loading) return <AppShell variant="elder"><p>오늘의 안부를 준비하고 있어요...</p></AppShell>;
  const question = questions[index];
  if (!question) return <AppShell variant="elder"><p>준비된 질문이 없습니다.</p></AppShell>;

  return (
    <AppShell variant="elder">
      <div className="e-topbar">
        <FontSizeToggle />
        <span>Callog</span>
      </div>
      <ProgressBar current={index + 1} total={questions.length} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SpeakButton text={question.question} />
      </div>
      <h1 className="e-question">{question.question}</h1>

      {question.options.map((option) => (
        <button key={option} className="e-choice" onClick={() => answer(option)}>
          {option}
        </button>
      ))}
    </AppShell>
  );
}
