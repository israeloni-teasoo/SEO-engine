import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
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
  // Set the theme before paint to avoid a flash of the wrong palette.
  const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
