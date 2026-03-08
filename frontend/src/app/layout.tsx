import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0a0a14",
  width: "device-width",
  initialScale: 1,
  // Do NOT set maximumScale/userScalable — causes iOS zoom glitch on inputs
};

export const metadata: Metadata = {
  title: "OptionI",
  description:
    "Automated options trading dashboard for the Indian stock market via the Dhan brokerage API.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OptionI",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-180.png", // PNG required — iOS ignores SVG for homescreen
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Service worker — enables cache-first loading & instant iOS tab resume */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(e) {
                    console.warn('SW failed:', e);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
