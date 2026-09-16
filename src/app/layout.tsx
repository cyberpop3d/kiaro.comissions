import type { Metadata } from 'next';
import { CommissionNotificationBridge } from '@/components/CommissionNotificationBridge';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yontuk Commissions',
  description: 'Private commission and file communication portal for Yontuk.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CommissionNotificationBridge />
        {children}
      </body>
    </html>
  );
}
