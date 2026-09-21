import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n/provider";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/lib/theme";
import { RegisterServiceWorker } from "@/components/register-sw";

// Кириллица нужна для русского и украинского интерфейса: без неё браузер подставит запасной шрифт.
const manrope = Manrope({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-manrope" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "Pozna.logist",
  description: "Ładunki i przewoźnicy — dopasowanie w czasie rzeczywistym",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Pozna.logist" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1d4fd6" },
    { media: "(prefers-color-scheme: dark)", color: "#0d111a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: скрипт ниже ставит data-theme до гидратации, и атрибут отличается от серверного HTML.
    <html lang="pl" className={`${manrope.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>{children}</AuthProvider>
          </I18nProvider>
        </ThemeProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
