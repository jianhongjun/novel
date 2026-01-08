# 静态链接工具函数使用说明

## 概述

已实现代码层面的静态链接处理方案，所有链接在构建时会自动添加 `.html` 后缀，适用于 Next.js 静态导出部署到静态服务器。

## 工具函数

**文件位置**：`src/lib/staticLink.ts`

**函数**：`getStaticLink(path: string): string`

### 功能

- 自动为路径添加 `.html` 后缀
- 正确处理查询参数
- 根路径自动转换为 `index.html`

### 使用示例

```typescript
import { getStaticLink } from '@/lib/staticLink';

// 基本路径
getStaticLink('/book') // => '/book.html'
getStaticLink('/book/read') // => '/book/read.html'

// 带查询参数
getStaticLink('/book?id=123') // => '/book.html?id=123'
getStaticLink('/book/read?id=123&chapter=456') // => '/book/read.html?id=123&chapter=456'

// 根路径
getStaticLink('/') // => '/index.html'
getStaticLink('/?tab=male') // => '/index.html?tab=male'

// 已包含 .html 的路径（不会重复添加）
getStaticLink('/book.html?id=123') // => '/book.html?id=123'
```

## 已替换的文件

所有使用 `href` 和 `window.location` 的地方都已替换为使用 `getStaticLink`：

### 1. `src/app/page.tsx`
- ✅ 分类按钮：`href={getStaticLink('/category')}`
- ✅ 书籍列表：`href={getStaticLink(\`/book?id=${book.id}\`)}`

### 2. `src/app/book/page.tsx`
- ✅ 返回首页：`href={getStaticLink('/')}`
- ✅ 目录按钮：`href={getStaticLink(\`/book/catalog?id=${book.id}\`)}`
- ✅ 跳转章节页：`window.location.href = getStaticLink(\`/book/read?id=${bookId}...\`)}`

### 3. `src/app/book/read/page.tsx`
- ✅ 返回按钮：`href={getStaticLink(\`/book?id=${bookId}\`)}`
- ✅ 目录按钮：`href={getStaticLink(\`/book/catalog?id=${bookId}\`)}`
- ✅ 书签跳转：`window.location.replace(getStaticLink(\`/book/read?id=${bookId}...\`))`

### 4. `src/app/book/catalog/page.tsx`
- ✅ 返回按钮：`href={getStaticLink(\`/book?id=${bookId}\`)}`
- ✅ 书封页链接：`href={getStaticLink(\`/book?id=${bookId}\`)}`
- ✅ 章节列表：`href={getStaticLink(\`/book/read?id=${bookId}&chapter=${chapter.ccid}\`)}`

## 构建和部署

### 构建

```bash
npm run build
# 或
next build
```

构建完成后，`out/` 目录下的所有 HTML 文件都会包含正确的 `.html` 链接。

### 部署

直接将 `out/` 目录部署到任何静态服务器即可，无需额外配置：

- ✅ Nginx
- ✅ Apache
- ✅ CDN（如 Cloudflare Pages、Vercel、Netlify）
- ✅ 简单的 HTTP 服务器

### 验证

构建后，检查生成的 HTML 文件，所有链接都应该包含 `.html` 后缀：

```html
<!-- 之前 -->
<a href="/book?id=123">书籍</a>

<!-- 之后 -->
<a href="/book.html?id=123">书籍</a>
```

## 优势

1. **代码层面处理**：不依赖服务器配置
2. **自动处理**：所有链接统一处理，无需手动修改
3. **类型安全**：TypeScript 支持，编译时检查
4. **易于维护**：集中管理，修改方便

## 注意事项

1. **开发环境**：开发时（`next dev`）链接仍然正常工作，因为 Next.js 开发服务器会自动处理
2. **生产环境**：只有静态导出（`next build`）时才会生成带 `.html` 的链接
3. **已包含 .html**：如果路径已经包含 `.html`，函数不会重复添加

## 路径映射表

| 原始路径 | 转换后路径 |
|---------|----------|
| `/` | `/index.html` |
| `/book?id=123` | `/book.html?id=123` |
| `/book/read?id=123&chapter=456` | `/book/read.html?id=123&chapter=456` |
| `/book/catalog?id=123` | `/book/catalog.html?id=123` |
| `/category` | `/category.html` |

