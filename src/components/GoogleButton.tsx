'use client';

import { getOrCreateGoogleConversation } from '@/lib/firebase/data';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function GoogleButton({ label = 'Sign in with Google', className = '' }: { label?: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true);
    try {
      const result = await getOrCreateGoogleConversation();
      router.push(`/chat/${result.conversationId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" disabled={busy} onClick={login} className={`btn-primary inline-flex items-center justify-center gap-2 px-6 py-4 text-sm font-black ${className}`}>
      {busy ? 'Opening…' : label} <ArrowRight size={16} />
    </button>
  );
}
