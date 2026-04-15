import type { Metadata } from "next";
import { Syncopate, Space_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";
import { cn } from "@/lib/utils";

const syncopate = Syncopate({
  variable: "--font-syncopate",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Emotion Time Travel | AI-Powered Emotional Clarity",
  description: "Untangle your past, present, and future with specialized AI agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body
        className={cn(
          syncopate.variable,
          spaceMono.variable,
          "antialiased bg-deep-indigo text-white font-space-mono min-h-full selection:bg-neon-cyan selection:text-deep-indigo"
        )}
      >
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
