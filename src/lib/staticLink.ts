/**
 * 静态导出时，为链接添加 .html 后缀
 * 用于 Next.js 静态导出部署到静态服务器
 * 仅在构建/生产环境添加 .html，开发环境（localhost）不添加
 * 
 * @param path - 原始路径，例如 '/book?id=123'
 * @returns 添加了 .html 后缀的路径（生产环境），或原始路径（开发环境）
 * 
 * @example
 * // 开发环境（localhost）
 * getStaticLink('/book?id=123') // => '/book?id=123'
 * 
 * // 生产环境（构建后）
 * getStaticLink('/book?id=123') // => '/book.html?id=123'
 * getStaticLink('/book/read?id=123&chapter=456') // => '/book/read.html?id=123&chapter=456'
 * getStaticLink('/') // => '/index.html'
 */
export function getStaticLink(path: string): string {
  // 如果路径已经包含 .html，直接返回
  if (path.includes('.html')) {
    return path;
  }
  
  // 检查是否为开发环境（localhost 或 127.0.0.1）
  // 在客户端代码中，通过 window.location.hostname 判断
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    
    // 开发环境：直接返回原始路径，不添加 .html
    if (isDevelopment) {
      return path;
    }
  } else {
    // 服务端渲染时，通过环境变量判断
    // 如果是开发环境，不添加 .html
    if (process.env.NODE_ENV === 'development') {
      return path;
    }
  }
  
  // 生产环境（构建后）：添加 .html 后缀
  // 分离路径和查询参数
  const [basePath, queryString] = path.split('?');
  
  // 如果是根路径，返回 index.html
  if (basePath === '/' || basePath === '') {
    return queryString ? `/index.html?${queryString}` : '/index.html';
  }
  
  // 添加 .html 后缀
  const htmlPath = `${basePath}.html`;
  
  // 如果有查询参数，重新拼接
  return queryString ? `${htmlPath}?${queryString}` : htmlPath;
}

