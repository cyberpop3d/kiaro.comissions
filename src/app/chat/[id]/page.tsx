'use client';

import { ConversationView } from '@/components/ConversationView';
import { TopNav } from '@/components/TopNav';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [accessKey, setAccessKey] = useState<string | null>(null);

  useEffect(() => {
    const key = localStorage.getItem('kiaro.accessKey');
    const savedId = localStorage.getItem('kiaro.conversationId');
    if (!key || savedId !== params.id) {
      router.push('/');
      return;
    }
    setAccessKey(key);
  }, [params.id, router]);

  if (!accessKey) return null;

  return (
    <main className="min-h-screen pb-10">
      <TopNav right={<a href="/" className="btn-ghost px-5 py-3 text-sm font-bold">Portal</a>} />
      <div className="mx-auto max-w-7xl px-5">
        <ConversationView conversationId={params.id} role="customer" accessKey={accessKey} accessKeyBanner />
      </div>
    </main>
  );
}
