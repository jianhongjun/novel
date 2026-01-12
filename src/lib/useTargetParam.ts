/**
 * Hook 用于在客户端动态更新所有链接的 target 参数
 * 解决服务端渲染时链接 href 已确定，无法动态添加 target 的问题
 */
import { useEffect } from 'react';

export function useTargetParam() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. 检查并保存当前 URL 中的 target 参数
    let targetParam = '';
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const targetFromUrl = urlParams.get('target');
      if (targetFromUrl) {
        targetParam = targetFromUrl;
        localStorage.setItem('__target_param', targetFromUrl);
      } else {
        // 如果 URL 中没有，从 localStorage 获取之前保存的值
        const savedTarget = localStorage.getItem('__target_param');
        if (savedTarget) {
          targetParam = savedTarget;
        }
      }
    } catch (e) {
      // 忽略错误
    }

    // 如果没有 target 参数，不需要更新链接
    if (!targetParam) return;

    // 2. 更新页面中所有链接的 target 参数
    // 查找所有 <a> 标签，检查其 href 是否缺少 target 参数
    const updateLinks = () => {
      const links = document.querySelectorAll('a[href]');
      links.forEach((link) => {
        const anchor = link as HTMLAnchorElement;
        const href = anchor.getAttribute('href');
        if (!href) return;

        // 跳过外部链接和锚点链接
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')) {
          return;
        }

        try {
          // 处理相对路径
          const baseUrl = window.location.origin;
          const url = new URL(href, baseUrl);
          
          // 只处理同域名的链接
          if (url.origin !== baseUrl) {
            return;
          }

          // 如果链接中没有 target 参数，则添加
          if (!url.searchParams.has('target')) {
            url.searchParams.set('target', targetParam);
            // 更新 href 属性（保持相对路径格式）
            const newHref = url.pathname + url.search + url.hash;
            anchor.setAttribute('href', newHref);
          }
        } catch (e) {
          // 如果无法解析 URL，忽略
        }
      });
    };

    // 延迟执行，确保 DOM 已完全加载
    const timeoutId = setTimeout(() => {
      updateLinks();
    }, 100);

    // 监听 DOM 变化，动态更新新添加的链接
    const observer = new MutationObserver(() => {
      updateLinks();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, []);
}

