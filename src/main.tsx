import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { redirectExternalDeepLink } from './deepLink'

// 유튜브 채널로 넘어가는 공유 링크면 앱을 그리지 않음
if (!redirectExternalDeepLink()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
