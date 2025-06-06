"use client";

import '@fortawesome/fontawesome-svg-core/styles.css'
import Footer from "@/components/footer";
import { Inter } from "next/font/google";
import cn from "classnames";
import Script from "next/script";
import * as gtag from "../lib/gtag";
import "./globals.css";
import {usePathname, useRouter} from "next/navigation";
import {useEffect} from "react";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,}: Readonly<{ children: React.ReactNode; }>) {

  const pathname = usePathname();

  useEffect(() => {
      if(!pathname) return;
      gtag.pageView(pathname);
  }, [pathname]);

  return (
    <html lang="ja">
    <head>
        <Script strategy="afterInteractive"
                src={`https://www.googletagmanager.com/gtag/js?id=${gtag.GA_MEASUREMENT_ID}`}/>
        <Script
            id="gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
                __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
  
            gtag('config', '${gtag.GA_MEASUREMENT_ID}');
            `
            }}
        />
        <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/favicon/apple-touch-icon.png"
        />
        <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href="/favicon/favicon-32x32.png"
        />
        <link
            rel="icon"
            type="image/png"
            sizes="16x16"
            href="/favicon/favicon-16x16.png"
        />
        <link rel="manifest" href="/favicon/site.webmanifest"/>
        <link
            rel="mask-icon"
            href="/favicon/safari-pinned-tab.svg"
            color="#000000"
        />
        <link rel="shortcut icon" href="/favicon/favicon.ico"/>
        <meta name="msapplication-TileColor" content="#000000"/>
        <meta
            name="msapplication-config"
            content="/favicon/browserconfig.xml"
        />
        <meta name="theme-color" content="#000"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Chrononglyph</title>
    </head>
    <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
