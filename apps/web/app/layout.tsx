import type { Metadata, Viewport } from "next";
import { Amiri, IBM_Plex_Sans_Arabic } from "next/font/google";
import { AuthProvider } from "../components/AuthProvider";
import { I18nProvider } from "../components/I18nProvider";
import { PwaInstallButton } from "../components/PwaInstallButton";
import { PwaRegister } from "../components/PwaRegister";
import { SettingsHydrate } from "../components/SettingsHydrate";
import "./globals.css";

const fontUi = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-vk-ui",
  display: "swap",
});

const fontAyah = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-vk-ayah",
  display: "swap",
});

export const metadata: Metadata = {
  title: "الكُتَّاب أون لاين",
  description: "استمع · كرّر · سجّل — تغذية راجعة على مستوى الكلمة",
  applicationName: "الكُتَّاب",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "الكُتَّاب",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2D5A3D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${fontUi.variable} ${fontAyah.variable}`}>
      <body>
        <I18nProvider>
          <AuthProvider>
            <SettingsHydrate />
            <PwaRegister />
            <PwaInstallButton />
            {children}
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
