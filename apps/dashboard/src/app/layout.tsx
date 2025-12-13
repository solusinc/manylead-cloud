import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@manylead/ui/theme";
import { Toaster } from "sonner";
import { TooltipProvider } from "@manylead/ui/tooltip";
import { cn } from "@manylead/ui";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TRPCReactProvider } from "~/lib/trpc/react";
import { defaultMetadata, ogMetadata, twitterMetadata } from "./metadata";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
          inter.variable,
          "font-sans antialiased",
        )}
      >
        <NuqsAdapter>
          <TRPCReactProvider>
            <ThemeProvider>
              <TooltipProvider>
                {children}
                <Toaster richColors expand />
              </TooltipProvider>
            </ThemeProvider>
          </TRPCReactProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
