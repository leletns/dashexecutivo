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
  "Dash executivo: inteligência estratégica, gestão jurídica, contábil e de marketing em tempo real.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Dash executivo",
    template: "%s · Dash executivo",
  },
  description,
  applicationName: "Dash executivo",
  authors: [{ name: "Dash executivo" }],
  generator: "Next.js",
  keywords: [
    "Dash executivo",
    "Dashboard executivo",
    "Inteligência estratégica",
    "Gestão financeira",
    "Gestão jurídica",
    "Gestão contábil",
    "Marketing",
    "Auto-conciliação bancária",
    "Tempo real",
  ],
  category: "business",
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Dash executivo",
    title: "Dash executivo",
    description,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Dash executivo",
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
