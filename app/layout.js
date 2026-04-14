import "./globals.css";

export const metadata = {
  title: "Snake",
  description: "Classic snake game built with Next.js",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
