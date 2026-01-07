import type { Metadata } from 'next';
import Script from 'next/script';
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
        {/* CNZZ 统计脚本 - 使用 beforeInteractive 确保尽早加载 */}
        <Script
          id="cnzz-statistics"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              var _czc = _czc || [];
              _czc.push(["_setAccount", "1281454302"]);
              (function () {
                var um = document.createElement("script");
                um.src = "https://s4.cnzz.com/z.js?id=1281454302&async=1";
                um.type = "text/javascript";
                var s = document.getElementsByTagName("script")[0];
                s.parentNode.insertBefore(um, s);
              })();
            `
          }}
        />
        {children}
      </body>
    </html>
  );
}


