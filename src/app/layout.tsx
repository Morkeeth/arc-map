import type { Metadata } from "next";
import "./globals.css";
import "./discovery.css";

export const metadata: Metadata = {
  title: "ARC MAP — Find your next rabbit hole",
  description: "Explore Arc, follow the stories, and send a hunter after the questions that matter.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
