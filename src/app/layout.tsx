import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { UserRole } from "@/components/Sidebar/Sidebar";

// 使用系统字体，避免 Google Fonts 网络问题
const systemFont = `
  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial,
  "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol",
  "Noto Color Emoji"
`;

export const metadata: Metadata = {
  title: "Trade ERP",
  description: "外贸 ERP 系统",
};

// 客户端组件处理 Sidebar（需要访问 localStorage）
function SidebarWrapper() {
  // 在服务端返回 null，由客户端组件处理
  return null;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body style={{ fontFamily: systemFont }} className="antialiased bg-zinc-50 dark:bg-zinc-950">
        <Providers>
          <Navbar />
          <main className="lg:pl-16 transition-all duration-300">
            {children}
          </main>
          <Sidebar currentRole="USER" />
        </Providers>
      </body>
    </html>
  );
}
