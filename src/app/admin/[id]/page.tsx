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
    const saved = localStorage.getItem('kiaro.adminSecret');
    if (!saved) {
      router.push('/admin');
      return;
    }
    setSecret(saved);
  }, [router]);

  if (!secret) return null;

  return (
    <main className="min-h-screen pb-10">
      <TopNav right={<a href="/admin" className="btn-ghost px-5 py-3 text-sm font-bold">Inbox</a>} />
      <div className="mx-auto max-w-7xl px-5">
        <ConversationView conversationId={params.id} role="admin" adminSecret={secret} />
      </div>
    </main>
  );
}
