import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateQuestions } from "../lib/dailyQuestions";

// 그날 첫 안부에서 미리 만들어둔 질문이 없을 때 쓰는 즉석 생성 경로.
//
// 평소에는 새벽 크론이 미리 만들어두므로 여기까지 오지 않는다(어르신을 기다리게 하지 않기
// 위함 — 근거: 실사용 피드백 "버퍼링이 걸린다"). 크론 뒤에 등록된 어르신처럼 미리 만들어둔
// 것이 없는 경우를 위해 남겨둔다.
//
// 문항 생성·검증 규칙은 lib/dailyQuestions.ts에 있다(크론과 같은 로직을 쓴다).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const { conditions = [], recentQuestions = [] } = (req.body ?? {}) as {
    conditions?: string[];
    recentQuestions?: string[];
  };
  const result = await generateQuestions(process.env.GEMINI_API_KEY, conditions, recentQuestions);
  res.status(200).json(result);
}
