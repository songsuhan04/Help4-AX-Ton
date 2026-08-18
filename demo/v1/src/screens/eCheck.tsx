import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { SpeakButton } from "../components/SpeakButton";
import { ProgressBar } from "../components/ProgressBar";
import { FontSizeToggle } from "../components/FontSizeToggle";
import { buildDailyQuestions } from "../domain/conditions";
import { getStoredElderProfileId } from "../lib/elderSession";
import { getSupabase, supabaseConfigured } from "../lib/supabase";

export const SCREEN_ID = "eCheck";

export default function ECheck() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    const elderId = getStoredElderProfileId();
    getSupabase()
      .from("elder_condition")
      .select("condition_type")
      .eq("elder_profile_id", elderId)
      .then(({ data }) => {
        const ids = (data ?? []).map((r) => r.condition_type as string);
        setQuestions(buildDailyQuestions(ids));
        setLoading(false);
      });
  }, []);

  function answer(value: boolean) {
    const next = [...answers, value];
    setAnswers(next);
    if (index + 1 < questions.length) {
      setIndex(index + 1);
    } else {
      finish(next);
    }
  }

  async function finish(finalAnswers: boolean[]) {
    const elderId = getStoredElderProfileId();
    await getSupabase()
      .from("daily_checkin")
      .upsert(
        {
          elder_profile_id: elderId,
          date: new Date().toISOString().slice(0, 10),
          answers: questions.reduce((acc, q, i) => ({ ...acc, [q]: finalAnswers[i] }), {}),
          skipped: false,
        },
        { onConflict: "elder_profile_id,date" }
      );
    navigate("/elder/speech");
  }

  if (loading) return <AppShell variant="elder"><p>불러오는 중...</p></AppShell>;
  const question = questions[index];

  return (
    <AppShell variant="elder">
      <div className="e-topbar">
        <FontSizeToggle />
        <span>Callog</span>
      </div>
      <ProgressBar current={index + 1} total={questions.length} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SpeakButton text={question} />
      </div>
      <h1 className="e-question">{question}</h1>

      <button className="e-choice" onClick={() => answer(true)}>네, 그래요</button>
      <button className="e-choice" onClick={() => answer(false)}>아직이에요</button>
    </AppShell>
  );
}
