import type { Metadata } from 'next';
import './globals.css';
import './workbench.css';
import './models.css';
export const metadata: Metadata = {
  title: 'CivOS — Kris Ledel',
  description:
    'A workspace for evidence, perspectives, review, decisions and follow-up.',
  authors: [{ name: 'Kris Ledel' }],
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
