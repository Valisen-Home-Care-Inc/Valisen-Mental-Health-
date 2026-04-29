import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Valisen Mental Health - Therapy matching in Ottawa and Ontario",
  description:
    "Ottawa-based therapy matching service connecting Ontario residents with Registered Psychotherapists and Registered Social Workers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
