import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import RootLayoutContent from "@/components/RootLayoutContent";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body style={{ fontFamily: systemFont }} className="antialiased">
        <Providers>
          <RootLayoutContent>{children}</RootLayoutContent>
        </Providers>
      </body>
    </html>
  );
}
