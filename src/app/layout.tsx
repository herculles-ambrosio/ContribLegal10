import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthPageWrapper from "@/components/AuthPageWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Contribuinte Legal",
  description: "Sistema de cadastro de documentos e sorteios de prêmios para contribuintes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Toaster position="top-center" />
        <AuthPageWrapper>
          {children}
        </AuthPageWrapper>
      </body>
    </html>
  );
}
