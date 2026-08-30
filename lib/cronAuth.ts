import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * 크론 엔드포인트 인증. 통과하면 true, 막았으면 false(응답은 여기서 보낸다).
 *
 * 예전에는 `if (cronSecret && 헤더가 다르면) 401` 이었다. 즉 환경변수가 없으면 검사를
 * 통째로 건너뛰어 누구나 부를 수 있었다. 설정이 빠졌을 때 열리는 쪽으로 실패한 것이다.
 *
 * 이 엔드포인트들은 영상편지·음성 파일을 지우고, 어르신 수만큼 Gemini를 부르고, 보호자에게
 * 알림을 보낸다. 저장소가 public이라 주소도 그대로 드러나 있다. 설정이 빠졌으면 아무나
 * 부르게 두는 것보다 아무도 못 부르게 막는 편이 낫다 — 크론이 안 도는 것은 눈에 띄지만,
 * 열려 있는 것은 눈에 띄지 않는다.
 */
export function authorizeCron(req: VercelRequest, res: VercelResponse): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("authorizeCron: CRON_SECRET이 설정되지 않아 요청을 거부합니다");
    res.status(503).json({
      error: "cron_secret_not_configured",
      hint: "Vercel 환경변수에 CRON_SECRET을 설정한 뒤 재배포하세요.",
    });
    return false;
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}
