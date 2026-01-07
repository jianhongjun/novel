/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // 启用静态导出
  images: {
    unoptimized: true
  }
};

export default nextConfig;


