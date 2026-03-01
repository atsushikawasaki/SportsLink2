import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import ToastContainer from "@/features/toast/components/ToastContainer";
import ConfirmModalGlobal from "@/features/confirm/components/ConfirmModalGlobal";
import { QueryProvider } from "@/providers/QueryProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
