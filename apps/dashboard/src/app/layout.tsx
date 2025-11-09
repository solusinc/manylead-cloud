import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import LocalFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@manylead/ui/theme";
import { Toaster } from "@manylead/ui/toast";
import { cn } from "@manylead/ui";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TRPCReactProvider } from "~/lib/trpc/react";
import { defaultMetadata, ogMetadata, twitterMetadata } from "./metadata";

const cal = LocalFont({
  src: "../../public/fonts/CalSans-SemiBold.ttf",
  variable: "--font-cal-sans",
});

const commitMono = LocalFont({
  src: [
    {
      path: "../../public/fonts/CommitMono-400-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/CommitMono-400-Italic.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/CommitMono-700-Regular.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/CommitMono-700-Italic.otf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-commit-mono",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  ...defaultMetadata,
  twitter: {
    ...twitterMetadata,
  },
  openGraph: {
    ...ogMetadata,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          cal.variable,
          commitMono.variable,
          inter.variable,
          "font-sans antialiased",
        )}
      >
        <NuqsAdapter>
          <TRPCReactProvider>
            <ThemeProvider>
              {children}
              <Toaster richColors expand />
            </ThemeProvider>
          </TRPCReactProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
