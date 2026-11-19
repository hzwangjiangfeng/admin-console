import type { ReactNode } from 'react';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';

export function AppProviders({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  // Provider 的配置只对它包住的组件生效，因为组件会沿组件树向上找对应的 Provider，所以写的时候要清楚——谁需要读取谁的配置？
  return (
    // 查询客户端
    <QueryClientProvider client={queryClient}>
      {/* 统一设置 Ant Design 主题和语言。 */}
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#2563eb',
            borderRadius: 8,
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          },
        }}
      >
        {/* 提供消息和通知，页面可通过 App.useApp() 使用。 */}
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
