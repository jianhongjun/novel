/**
 * 静态导出时，为链接添加 .html 后缀
 * 用于 Next.js 静态导出部署到静态服务器
 * 
 * @param path - 原始路径，例如 '/book?id=123'
 * @returns 添加了 .html 后缀的路径，例如 '/book.html?id=123'
 * 
 * @example
 * getStaticLink('/book?id=123') // => '/book.html?id=123'
 * getStaticLink('/book/read?id=123&chapter=456') // => '/book/read.html?id=123&chapter=456'
 * getStaticLink('/') // => '/index.html'
 */
export function getStaticLink(path: string): string {
  // 如果路径已经包含 .html，直接返回
  if (path.includes('.html')) {
    return path;
  }
  
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

