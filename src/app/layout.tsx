import type { Metadata } from "next";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "TestPilot AI —— AI 测试开发助手",
  description: "用自然语言快速创建和运行自动化测试",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
