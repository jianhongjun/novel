# Nginx 配置说明

## 文件说明

1. **`nginx.conf.recommended`** - 推荐配置（最简单，推荐使用）
2. **`nginx.conf`** - 完整配置（为每个路径单独配置，更明确）
3. **`nginx.conf.simple`** - 简化配置（备用方案）

## 使用方法

### 1. 修改配置中的路径

打开配置文件，将 `/path/to/out` 替换为你的 `out` 目录的绝对路径：

```nginx
root /path/to/out;  # 例如：root /var/www/ixiaoshuo.online/out;
```

### 2. 测试配置

```bash
# 检查配置语法
nginx -t -c /path/to/nginx.conf

# 如果使用系统 Nginx
sudo nginx -t
```

### 3. 应用配置

```bash
# 如果使用独立配置文件
nginx -c /path/to/nginx.conf

# 如果使用系统 Nginx
sudo nginx -s reload
```

## 配置说明

### 推荐配置的工作原理

```nginx
location / {
    try_files $uri $uri.html $uri/ /index.html;
}
```

这个配置会按以下顺序尝试：

1. **`$uri`** - 尝试精确匹配（如 `/book`）
2. **`$uri.html`** - 尝试添加 `.html` 后缀（如 `/book.html`）
3. **`$uri/`** - 如果是目录，尝试目录下的 index.html
4. **`/index.html`** - 最后回退到首页

**重要**：`try_files` 会自动忽略查询参数，所以：
- 访问 `/book?id=123` → 会尝试 `/book.html`
- 访问 `/book/read?id=123&chapter=456` → 会尝试 `/book/read.html`

### 路径映射

根据你的代码，以下路径会被正确映射：

| 访问路径 | 实际文件 |
|---------|---------|
| `/` | `index.html` |
| `/book?id=123` | `book.html` |
| `/book/read?id=123&chapter=456` | `book/read.html` |
| `/book/catalog?id=123` | `book/catalog.html` |
| `/category` | `category.html` |
| `/category-list?category=玄幻&freeType=1` | `category-list.html` |

## 其他静态服务器配置

### Apache (.htaccess)

如果使用 Apache，在 `out` 目录下创建 `.htaccess` 文件：

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # 处理带查询参数的路径
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ $1.html [L,QSA]
  
  # 如果 .html 文件也不存在，回退到 index.html
  RewriteCond %{REQUEST_FILENAME}.html !-f
  RewriteRule ^(.*)$ index.html [L,QSA]
</IfModule>
```

### Node.js (serve 包)

```bash
# 安装 serve
npm install -g serve

# 运行（会自动处理 SPA 路由）
serve -s out -p 9017
```

### Python (http.server)

```python
# 需要自定义处理，或者使用其他工具
```

## 验证

配置完成后，访问以下 URL 验证：

- http://localhost:9017/
- http://localhost:9017/book?id=123
- http://localhost:9017/book/read?id=123&chapter=456
- http://localhost:9017/book/catalog?id=123
- http://localhost:9017/category
- http://localhost:9017/category-list?category=玄幻&freeType=1

所有路径都应该正常显示页面，而不是目录列表。

