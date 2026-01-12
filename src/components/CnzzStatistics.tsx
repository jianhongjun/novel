'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

export default function CnzzStatistics() {
  const [scriptContent, setScriptContent] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 获取 target 参数
    const getTargetParam = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('target');
      } catch (e) {
        return null;
      }
    };

    const target = getTargetParam();
    
    // 根据 target 参数决定使用哪个统计代码
    // 如果没有 target，或 target 是空、null，或 target=hs，使用原来的统计代码（id=1281454302）
    // 如果 target=life，使用新的统计代码（id=1281457177）
    let script = '';
    
    if (target === 'life') {
      // target=life 时使用新的统计代码（不包含 _setAccount）
      script = `
        var _czc = _czc || [];
        (function () {
          var um = document.createElement("script");
          um.src = "https://s9.cnzz.com/z.js?id=1281457177&async=1";
          um.type = "text/javascript";
          var s = document.getElementsByTagName("script")[0];
          s.parentNode.insertBefore(um, s);
        })();
      `;
    } else {
      // 其他情况使用原来的统计代码（包含 _setAccount）
      script = `
        var _czc = _czc || [];
        _czc.push(["_setAccount", "1281454302"]);
        (function () {
          var um = document.createElement("script");
          um.src = "https://s4.cnzz.com/z.js?id=1281454302&async=1";
          um.type = "text/javascript";
          var s = document.getElementsByTagName("script")[0];
          s.parentNode.insertBefore(um, s);
        })();
      `;
    }

    setScriptContent(script);
  }, []);

  if (!scriptContent) {
    return null;
  }

  return (
    <Script
      id="cnzz-statistics"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: scriptContent
      }}
    />
  );
}

