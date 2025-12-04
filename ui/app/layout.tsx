import React from "react";
import "@/app/globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { LayoutContent } from "@/app/components/LayoutContent";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";

// Initialize Inter font
const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Momemory - AI Memory System</title>
        <meta name="description" content="Momemory - AI Memory System" />
        <meta name="generator" content="Momemory" />
        <link rel="icon" href="/logo-s.svg" type="image/svg+xml" />
      </head>
      <body 
        className={cn("h-screen antialiased flex flex-col", inter.className, inter.variable)}
      >
        <Providers>
          <ErrorBoundary>
            <LayoutContent>{children}</LayoutContent>
          </ErrorBoundary>
          <Toaster />
          <SonnerToaster position="top-center" />
        </Providers>
      </body>
    </html>
  );
}