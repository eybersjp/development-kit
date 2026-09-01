import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSiteOrigin } from "./site-origin";
import "./globals.css";
import "./responsive-fixes.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export function generateMetadata(): Metadata {
  const metadataBase = getSiteOrigin();
  const title = "Development Kit Framework — Ship with discipline, not drift";
  const description = "A guarded software-development framework for AI coding agents, with specialist workflows, approval gates, and verification built in.";
  return { metadataBase, title, description, openGraph:{title,description,type:"website",images:[{url:"/og.png",width:1731,height:909,alt:"Development Kit Framework — Ship software with discipline, not drift"}]}, twitter:{card:"summary_large_image",title,description,images:["/og.png"]} };
}

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body className={`${sans.variable} ${mono.variable}`}>{children}</body></html>;
}
