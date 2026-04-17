import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GitX1 PR Moderator — AI Slop Firewall for GitHub",
  description:
    "Protect your open-source repositories from low-effort, AI-generated pull requests. GitX1 PR Moderator is the ultimate AI slop firewall — a free Chrome extension that scores PRs without blocking genuine contributors.",
  keywords: [
    "GitHub",
    "pull request",
    "AI slop",
    "code review",
    "browser extension",
    "Chrome extension",
    "open source",
    "PR moderation",
  ],
  openGraph: {
    title: "GitX1 PR Moderator — AI Slop Firewall for GitHub",
    description:
      "Protect your open-source repos from low-effort, AI-generated pull requests without blocking human contributors.",
    type: "website",
    siteName: "GitX1",
  },
  twitter: {
    card: "summary_large_image",
    title: "GitX1 PR Moderator — AI Slop Firewall for GitHub",
    description:
      "Protect your open-source repos from low-effort, AI-generated pull requests without blocking human contributors.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
