import type { Metadata } from "next";
import { Amiri, IBM_Plex_Sans_Arabic } from "next/font/google";
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
  title: "الكتّاب الافتراضي",
  description: "استمع · كرّر · سجّل — تغذية راجعة على مستوى الكلمة",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${fontUi.variable} ${fontAyah.variable}`}>
      <body>
        <SettingsHydrate />
        {children}
      </body>
    </html>
  );
}
