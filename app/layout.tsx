import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "东山岛之旅短情长｜家庭同行账本",
  description: "几个家庭一起旅行，随手登记费用，自动算清每家应收应补。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
