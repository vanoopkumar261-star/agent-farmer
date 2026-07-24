import type { Metadata } from "next";
import "./jaivik-sathi.css";

export const metadata: Metadata = {
  title: "Synthetic Nature",
};

export default function JaivikSathiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Fonts loaded at runtime via <link> (Next hoists these into <head>) */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500&display=swap"
      />
      <link
        rel="stylesheet"
        href="https://db.onlinewebfonts.com/c/2bf40ab72ea4897a3fd9b6e48b233a19?family=Garamond"
      />
      {children}
    </>
  );
}
