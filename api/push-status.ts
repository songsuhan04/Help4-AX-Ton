import type { VercelRequest, VercelResponse } from "@vercel/node";

// 웹 푸시 설정 진단용. 알림이 안 갈 때 원인이 "환경변수가 안 보인다"인지
// "키 형식이 틀렸다"인지 대시보드를 열지 않고 바로 구분하기 위해 만들었다.
//
// ⚠️ 키 값 자체는 절대 응답에 담지 않는다. 존재 여부와 길이·형식 위반만 알려준다.
// (공개키 87자, 비밀키 43자, 둘 다 URL-safe base64라 '='/'+'/'/' 가 없어야 정상)
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const pub = process.env.VITE_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;

  const describe = (v: string | undefined, expectedLen: number) => {
    if (!v) return { present: false };
    return {
      present: true,
      length: v.length,
      expectedLength: expectedLen,
      lengthOk: v.length === expectedLen,
      hasNamePrefix: v.includes("="),
      hasNonUrlSafeChars: /[+/]/.test(v),
      hasWhitespace: /\s/.test(v),
    };
  };

  res.status(200).json({
    publicKey: describe(pub, 87),
    privateKey: describe(priv, 43),
    // sendPush.ts의 ensureConfigured()와 동일한 조건
    wouldSendPush: Boolean(pub && priv),
  });
}
