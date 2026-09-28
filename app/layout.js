import "./globals.css";

export const metadata = {
  title: "Aura Skincare — Voice Support Agent",
  description: "AI Voice CX Agent demo for Aura Skincare",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
