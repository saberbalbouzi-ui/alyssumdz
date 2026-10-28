// أضف هذا إلى next.config.ts في مشروعك (الوضع المدمج فقط):
// يمنع Next من تجميع Lighthouse داخل الـ bundle (يجب أن يبقى حزمة Node عادية).
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['lighthouse', 'chrome-launcher'],
  // إن كنت على Next 14 استعمل بدلاً منها: experimental: {serverComponentsExternalPackages: ['lighthouse', 'chrome-launcher']}
};
export default nextConfig;
