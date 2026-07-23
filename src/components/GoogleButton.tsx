'use client';

import { getOrCreateGoogleConversation } from '@/lib/firebase/data';
import type { ServiceTopic } from '@/lib/types';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function GoogleButton({
  label = 'Sign in with Google',
  className = '',
  disabled = false,
  topic,
  termsAcceptedAt
}: {
  label?: string;
  className?: string;
  disabled?: boolean;
  topic: ServiceTopic | null;
  termsAcceptedAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function login() {
    if (!topic || !termsAcceptedAt) return;
    setBusy(true);
    try {
      const result = await getOrCreateGoogleConversation({ topic, termsAcceptedAt });
      router.push(`/chat/${result.conversationId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" disabled={busy || disabled} onClick={login} className={`btn-primary inline-flex items-center justify-center gap-2 px-6 py-4 text-sm font-black ${className}`}>
      {busy ? 'Opening…' : label} <ArrowRight size={16} />
    </button>
  );
}
