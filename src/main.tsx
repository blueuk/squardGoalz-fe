import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/ui.css'
import App from './App.tsx'
import { DialogHost } from './components/Dialog'
import { redirectExternalDeepLink } from './deepLink'

// 유튜브 채널로 넘어가는 공유 링크면 앱을 그리지 않음
if (!redirectExternalDeepLink()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <DialogHost />
    </StrictMode>,
  )
}
