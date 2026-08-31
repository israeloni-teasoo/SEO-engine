import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEO Engine — Blog Post Optimizer",
  description:
    "Analyze, score, and auto-fix blog posts for SEO and readability, then publish straight to WordPress.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
