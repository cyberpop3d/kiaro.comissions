'use client';

import { ConversationView } from '@/components/ConversationView';
import { TopNav } from '@/components/TopNav';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminConversationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);

  useEffect(() => {
    async function restoreAccess() {
      const saved = localStorage.getItem('kiaro.adminSecret');
      if (saved) {
        setSecret(saved);
        return;
      }

      const verification = await fetch('/api/admin/verify').catch(() => null);
      if (verification?.ok) {
        setSecret('__yontuk_cookie_auth__');
        return;
      }

      router.push('/admin');
    }

    void restoreAccess();
  }, [router]);

  if (!secret) return null;

  return (
    <main className="h-screen overflow-hidden">
      <TopNav right={<a href="/admin" className="btn-ghost px-5 py-3 text-sm font-bold">Inbox</a>} />
      <div className="mx-auto h-[calc(100vh-104px)] max-w-7xl overflow-hidden px-5 pb-5">
        <ConversationView conversationId={params.id} role="admin" adminSecret={secret} />
      </div>
    </main>
  );
}
