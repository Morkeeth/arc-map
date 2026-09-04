import type { Metadata } from "next";
import "./globals.css";
import "./discovery.css";
import "./workspace.css";
import { WalletProvider } from "@/components/wallet-provider";

export const metadata: Metadata = {
  title: "ARC MAP — Know what’s moving on Arc",
  description:
    "Explore Arc, follow the stories, and send a hunter after the questions that matter.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
