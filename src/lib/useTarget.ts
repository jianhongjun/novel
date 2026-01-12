/**
 * Hook 用于获取 target 参数（从 URL 或 localStorage）
 * 返回 target 参数值，用于在客户端动态生成链接
 */
import { useState, useEffect } from 'react';

export function useTarget(): string {
  const [target, setTarget] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 获取 target 参数
    const getTarget = () => {
      try {
        // 1. 首先尝试从当前 URL 获取
        const urlParams = new URLSearchParams(window.location.search);
        const targetFromUrl = urlParams.get('target');
        
        if (targetFromUrl) {
          // 保存到 localStorage
          try {
            localStorage.setItem('__target_param', targetFromUrl);
          } catch (e) {
            // 忽略错误
          }
          return targetFromUrl;
        } else {
          // 2. 从 localStorage 获取
          try {
            const savedTarget = localStorage.getItem('__target_param');
            return savedTarget || '';
          } catch (e) {
            return '';
          }
        }
      } catch (e) {
        return '';
      }
    };

    const targetValue = getTarget();
    setTarget(targetValue);
  }, []);

  return target;
}

