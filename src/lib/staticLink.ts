/**
 * 静态导出时，为链接添加 .html 后缀
 * 用于 Next.js 静态导出部署到静态服务器
 * 仅在构建/生产环境添加 .html，开发环境（localhost）不添加
 * 自动从当前URL获取 target 参数，并附加到所有链接中
 * 
 * @param path - 原始路径，例如 '/book?id=123'
 * @returns 添加了 .html 后缀的路径（生产环境），或原始路径（开发环境），并自动附加 target 参数
 * 
 * @example
 * // 开发环境（localhost）
 * getStaticLink('/book?id=123') // => '/book?id=123&target=123' (如果当前URL有target=123)
 * 
 * // 生产环境（构建后）
 * getStaticLink('/book?id=123') // => '/book.html?id=123&target=123' (如果当前URL有target=123)
 * getStaticLink('/book/read?id=123&chapter=456') // => '/book/read.html?id=123&chapter=456&target=123'
 * getStaticLink('/') // => '/index.html?target=123'
 */
export function getStaticLink(path: string): string {
  // 检查路径是否已经包含 .html
  const hasHtmlExtension = path.includes('.html');
  
  // 分离路径和查询参数
  let basePath = path;
  let queryString = '';
  
  if (hasHtmlExtension) {
    // 如果已经包含 .html，提取基础路径和查询参数
    const htmlIndex = path.indexOf('.html');
    basePath = path.substring(0, htmlIndex);
    const afterHtml = path.substring(htmlIndex + 5); // '.html' 长度为 5
    queryString = afterHtml.startsWith('?') ? afterHtml.substring(1) : '';
  } else {
    // 分离路径和查询参数
    const parts = path.split('?');
    basePath = parts[0];
    queryString = parts[1] || '';
  }
  
  // 从当前URL获取 target 参数（仅在客户端）
  // 优先从 URL 获取，如果没有则从 localStorage 获取之前保存的值
  let targetParam = '';
  if (typeof window !== 'undefined') {
    try {
      // 1. 首先尝试从当前 URL 获取 target 参数
      const urlParams = new URLSearchParams(window.location.search);
      const targetFromUrl = urlParams.get('target');
      
      if (targetFromUrl) {
        targetParam = targetFromUrl;
        // 如果 URL 中有 target，保存到 localStorage，以便后续页面使用
        try {
          localStorage.setItem('__target_param', targetFromUrl);
        } catch (e) {
          // localStorage 可能不可用，忽略错误
        }
      } else {
        // 2. 如果 URL 中没有 target，尝试从 localStorage 获取之前保存的值
        try {
          const savedTarget = localStorage.getItem('__target_param');
          if (savedTarget) {
            targetParam = savedTarget;
          }
        } catch (e) {
          // localStorage 可能不可用，忽略错误
        }
      }
    } catch (e) {
      // 如果无法解析URL，尝试从 localStorage 获取
      try {
        const savedTarget = localStorage.getItem('__target_param');
        if (savedTarget) {
          targetParam = savedTarget;
        }
      } catch (e2) {
        // 忽略错误
      }
    }
  }
  
  // 合并查询参数
  const queryParams = new URLSearchParams(queryString);
  
  // 如果当前URL有 target 参数，且目标链接中没有 target 参数，则添加
  if (targetParam && !queryParams.has('target')) {
    queryParams.set('target', targetParam);
  }
  
  // 重新构建查询字符串
  const newQueryString = queryParams.toString();
  
  // 如果路径已经包含 .html，直接返回（只添加target参数，不再添加.html）
  if (hasHtmlExtension) {
    const htmlPath = `${basePath}.html`;
    return newQueryString ? `${htmlPath}?${newQueryString}` : htmlPath;
  }
  
  // 构建最终路径（不包含.html）
  const finalPath = newQueryString ? `${basePath}?${newQueryString}` : basePath;
  
  // 检查是否为开发环境（localhost 或 127.0.0.1）
  // 在客户端代码中，通过 window.location.hostname 判断
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    
    // 开发环境：直接返回路径（已包含target参数），不添加 .html
    if (isDevelopment) {
      return finalPath;
    }
  } else {
    // 服务端渲染时，通过环境变量判断
    // 如果是开发环境，不添加 .html
    if (process.env.NODE_ENV === 'development') {
      return finalPath;
    }
  }
  
  // 生产环境（构建后）：添加 .html 后缀
  // 如果是根路径，返回 index.html
  if (basePath === '/' || basePath === '') {
    return newQueryString ? `/index.html?${newQueryString}` : '/index.html';
  }
  
  // 添加 .html 后缀
  const htmlPath = `${basePath}.html`;
  
  // 如果有查询参数，重新拼接
  return newQueryString ? `${htmlPath}?${newQueryString}` : htmlPath;
}

