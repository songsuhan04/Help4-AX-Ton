import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { SpeakButton } from "../components/SpeakButton";
import { redeemInvite } from "../lib/elderSession";
import { supabaseConfigured } from "../lib/supabase";

export const SCREEN_ID = "eInvited";

export default function EInvited() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured || !token) {
      setLoading(false);
      return;
    }
    redeemInvite(token)
      .then((result) => setName(result.name))
      .catch((err) => setError(err instanceof Error ? err.message : "연결에 실패했습니다"))
      .finally(() => setLoading(false));
  }, [token]);

  const message = name ? `${name}님, 초대를 받으셨어요` : "초대를 확인하고 있어요";

  return (
    <AppShell variant="elder">
      <div className="e-topbar">
        <span>Callog</span>
      </div>
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🌿</div>
        <h1 className="e-question" style={{ fontSize: 24 }}>{message}</h1>
        <p style={{ color: "rgba(255,255,255,0.75)" }}>하루에 한 번, 잘 지내시는지 짧게 여쭐게요.</p>
      </div>

      {loading && <p style={{ textAlign: "center" }}>확인 중...</p>}
      {error && <p style={{ color: "#ffb4a8", textAlign: "center" }}>{error}</p>}

      <SpeakButton text={message + ". 하루에 한 번, 잘 지내시는지 짧게 여쭐게요."} />
      <button className="e-primary" style={{ marginTop: 16 }} disabled={loading} onClick={() => navigate("/elder/check")}>
        시작하기
      </button>
    </AppShell>
  );
}
