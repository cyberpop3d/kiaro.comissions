import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kiaro Studio Commissions',
  description: 'Private commission and file communication portal for Kiaro Studio.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
