import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'CivOS — Kris Ledel',
  description:
    'Arbetsyta för kunskap, perspektiv, granskning, beslut och uppföljning.',
  authors: [{ name: 'Kris Ledel' }],
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv" className="dark">
      <body>{children}</body>
    </html>
  );
}
