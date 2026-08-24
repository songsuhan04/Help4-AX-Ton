import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { DisplaySettings } from "../components/DisplaySettings";
import { SpeakButton } from "../components/SpeakButton";
import { redeemInvite } from "../lib/elderSession";
import { supabaseConfigured } from "../lib/supabase";
import { getErrorMessage } from "../lib/errors";

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
      .catch((err) => setError(getErrorMessage(err, "연결에 실패했습니다")))
      .finally(() => setLoading(false));
  }, [token]);

  const message = name ? `${name}님, 초대를 받으셨어요` : "초대를 확인하고 있어요";

  return (
    <AppShell variant="elder">
      <div className="e-topbar">
        <DisplaySettings />
        <span className="e-brand">Callog</span>
      </div>
      <div className="e-hero">
        <img src="/callog-icon.png" alt="Callog(콜록)" width={64} height={64} style={{ borderRadius: 16, margin: "0 auto 10px" }} />
        <h1 className="e-question">{message}</h1>
        <p className="e-lead">하루에 한 번, 잘 지내시는지 짧게 여쭐게요.</p>
        {loading && <p className="e-meta">확인 중...</p>}
        {error && <p className="e-error">{error}</p>}
      </div>

      <SpeakButton text={message + ". 하루에 한 번, 잘 지내시는지 짧게 여쭐게요."} />
      <button className="e-primary" disabled={loading} onClick={() => navigate("/elder/home")}>
        시작하기
      </button>
    </AppShell>
  );
}
