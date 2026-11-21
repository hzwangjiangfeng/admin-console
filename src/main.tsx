import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { AppProviders } from './app/AppProviders';
import { createAppQueryClient } from './lib/queryClient';
import { createAppRouter } from './router';
import 'antd/dist/reset.css';
import './styles.css';

async function bootstrap() {
  // 开发或演示模式启用 Mock 时，先等接口就绪，再挂载页面
  if (
    (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK === 'true') ||
    import.meta.env.VITE_DEMO_MODE === 'true'
  ) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }

  // 找到 index.html 中的 #root，把 React 应用「渲染」到这个容器里
  createRoot(document.getElementById('root')!).render(
    // StrictMode 在开发时帮助发现组件中的潜在问题，组件函数可能被 React 调用多次
    <StrictMode>
      {/* 全局 Provider，负责组合全局的配置，比如主题、语言、缓存等  */}
      <AppProviders queryClient={createAppQueryClient()}>
        {/* 路由配置，页面可使用外层 AppProviders 提供的配置 */}
        <RouterProvider router={createAppRouter()} />
      </AppProviders>
    </StrictMode>,
  );
}
void bootstrap();
