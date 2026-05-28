import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProviderWrapper } from "@/components/auth/session-provider-wrapper";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const siteUrl = "https://portalexecutivo.app";
const description =
  "Portal BAPS: visão integrada da organização — financeiro, jurídico, contábil e muito mais.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Portal BAPS",
    template: "%s · Portal BAPS",
  },
  description,
  applicationName: "Portal BAPS",
  authors: [{ name: "Portal BAPS" }],
  generator: "Next.js",
  keywords: [
    "Portal BAPS",
    "Gestão financeira",
    "Gestão jurídica",
    "Gestão contábil",
    "Marketing",
    "Tempo real",
  ],
  category: "business",
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Portal BAPS",
    title: "Portal BAPS",
    description,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Portal BAPS",
    description,
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfcff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-svh app-bg font-sans overflow-x-hidden">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <SessionProviderWrapper>
            <TooltipProvider delayDuration={120}>
              {children}
              <Toaster
                position="top-center"
                toastOptions={{
                  classNames: {
                    toast:
                      "glass-strong !rounded-xl !border !border-border/60 !text-foreground",
                    description: "!text-muted-foreground",
                  },
                }}
              />
            </TooltipProvider>
          </SessionProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
