import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './effects.css' /* 独立动效：涟漪 + :active 点击反馈（不经过 Tailwind 管线，保证一定打进产物） */
import App from './App.tsx'
import { platform } from './platform';
import { CREATOR, CONTACT, COPYRIGHT, installHiddenMark } from './lib/watermark'

// 平台初始化（移动端状态栏/导航栏/返回键，桌面/浏览器无副作用）
void platform.initPlatform();

// 原创标记：全局常量挂载 + 隐形符号属性
// 前端页面不可见，仅作为底层代码常量存在，简单改界面无法清除
;(window as any).archiveCopyright = COPYRIGHT;
;(window as any).archiveAuthor = CREATOR;
;(window as any).archiveContact = CONTACT;
installHiddenMark();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
