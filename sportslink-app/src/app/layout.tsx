import type { Metadata } from "next";
import { Lexend, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import ToastContainer from "@/features/toast/components/ToastContainer";
import ConfirmModalGlobal from "@/features/confirm/components/ConfirmModalGlobal";
import { QueryProvider } from "@/providers/QueryProvider";

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SportsLink",
  description: "Sports tournament management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${lexend.variable} ${notoSansJP.variable} antialiased`}>
        <QueryProvider>
          <AuthProvider>
            {children}
            <ToastContainer />
            <ConfirmModalGlobal />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
