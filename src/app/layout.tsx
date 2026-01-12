import type { Metadata } from 'next';
import CnzzStatistics from '../components/CnzzStatistics';
import './globals.css';

export const metadata: Metadata = {
  title: '微米小说',
  description: '微米小说'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        {/* CNZZ 统计脚本 - 根据 target 参数动态加载不同的统计代码 */}
        <CnzzStatistics />
        {children}
      </body>
    </html>
  );
}


