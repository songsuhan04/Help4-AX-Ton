import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 배포된 화면이 어느 빌드인지 눈으로 구분할 수 있게 커밋 해시를 심는다.
// SPA는 클라이언트 라우팅만으로는 index.html을 다시 받지 않아, 탭을 열어둔 채로는
// 배포가 끝난 뒤에도 계속 예전 코드가 돌아간다. 그때 "고쳤는데 안 보인다"가 되는데
// 화면에 빌드 번호가 있으면 캐시 문제인지 코드 문제인지 즉시 구분된다.
const buildId = (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
})
