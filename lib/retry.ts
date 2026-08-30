// 일시적인 실패만 다시 시도한다.
//
// 음성 분석이 한 번 삐끗하면 그날 기록이 영구히 사라지고 있었다. 어르신은 분명히 말씀을
// 남겼는데 보호자에게는 "분석에 실패했습니다"만 남는다. 실제로 그런 일이 있었고, 나중에
// 손으로 다시 돌려보니 같은 파일이 정상 인식됐다 — 즉 파일이 아니라 그때의 호출이 문제였다.
//
// 모든 실패를 다시 시도하지는 않는다. 잘못된 요청이나 없는 파일은 몇 번을 해도 같다.
// 몰려서 거절당했거나(429), 서버가 잠깐 불안정하거나(5xx), 시간이 초과된 경우만 다시 한다.

/** 다시 시도할 만한 실패인가 */
export function isTransient(err: unknown): boolean {
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    /\b(429|500|502|503|504)\b/.test(message) ||
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("overload") ||
    message.includes("unavailable") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("socket hang up") ||
    message.includes("fetch failed")
  );
}

export interface RetryOptions {
  attempts?: number;
  /** 첫 대기 시간(ms). 실패할수록 두 배로 늘린다. */
  baseDelayMs?: number;
  /** 대기용 — 시험에서 실제로 기다리지 않게 갈아끼운다 */
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, err: unknown) => void;
}

/**
 * 함수 실행 시간 상한이 있으므로 재시도는 짧고 적게 한다. 여기서 오래 기다리면
 * 함수가 통째로 잘려서 실패 이유조차 남기지 못한다.
 */
export async function retryTransient<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 1_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === attempts || !isTransient(err)) throw err;
      options.onRetry?.(attempt, err);
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
