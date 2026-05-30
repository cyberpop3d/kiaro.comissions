'use client';

import { ConversationView } from '@/components/ConversationView';
import { TopNav } from '@/components/TopNav';
import { subscribeToConversation, updateConversationProfile, verifyAccess, waitForAuthUser } from '@/lib/firebase/data';
import type { Conversation } from '@/lib/types';
import { UserRound } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [accessKey, setAccessKey] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      const key = localStorage.getItem('kiaro.accessKey');
      const savedId = localStorage.getItem('kiaro.conversationId');
      const user = await waitForAuthUser();

      if (cancelled) return;
      const isGoogleUser = Boolean(user && !user.isAnonymous);
      const canUseLocalKey = !isGoogleUser && key && savedId === params.id;
      const ok = await verifyAccess(params.id, canUseLocalKey ? key : null).catch(() => false);

      if (!ok) {
        router.push('/');
        return;
      }

      if (isGoogleUser) {
        localStorage.removeItem('kiaro.accessKey');
      }

      setAccessKey(canUseLocalKey ? key : null);
      setCheckingAccess(false);
    }

    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  useEffect(() => {
    if (checkingAccess) return undefined;
    return subscribeToConversation(params.id, (nextConversation) => {
      setConversation(nextConversation);
      const nextName = nextConversation?.guest_sessions?.name || '';
      setUsername((current) => current || nextName);

      const promptKey = `kiaro.usernamePrompt.${params.id}`;
      if (!localStorage.getItem(promptKey)) {
        setUsernameOpen(true);
        localStorage.setItem(promptKey, 'shown');
      }
    });
  }, [checkingAccess, params.id]);

  const displayName = useMemo(() => {
    return conversation?.guest_sessions?.name || username || 'Set username';
  }, [conversation, username]);

  async function saveUsername() {
    const clean = username.trim();
    if (!clean) {
      setError('Please enter a username.');
      return;
    }

    setSavingName(true);
    setError('');
    try {
      await updateConversationProfile(params.id, { name: clean, email: conversation?.guest_sessions?.email || null });
      localStorage.setItem(`kiaro.usernamePrompt.${params.id}`, 'done');
      setUsernameOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update username.');
    } finally {
      setSavingName(false);
    }
  }

  if (checkingAccess) return null;

  return (
    <main className="h-screen overflow-hidden">
      <TopNav
        right={
          <button type="button" onClick={() => setUsernameOpen(true)} className="btn-ghost inline-flex items-center gap-2 px-5 py-3 text-sm font-bold">
            <UserRound size={16} /> {displayName}
          </button>
        }
      />
      <div className="mx-auto h-[calc(100vh-104px)] max-w-7xl overflow-hidden px-5 pb-5">
        <ConversationView conversationId={params.id} role="customer" accessKey={accessKey} accessKeyBanner={conversation?.auth_mode === 'guest' && Boolean(accessKey)} />
      </div>

      {usernameOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-5 backdrop-blur-sm">
          <div className="kiaro-card w-full max-w-md p-6">
            <h2 className="font-display text-3xl font-black">Choose your username</h2>
            <p className="mt-3 text-sm leading-6 text-kiaro-muted">This name will appear in your Kiaro Studio commission conversation.</p>
            {error ? <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
            <input
              className="glass-input mt-5 w-full px-4 py-4"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveUsername();
              }}
              placeholder="Username / studio name"
            />
            <div className="mt-4 flex gap-3">
              <button className="btn-primary flex-1 px-5 py-3 text-sm" disabled={savingName} onClick={saveUsername}>
                Save username
              </button>
              <button className="btn-ghost px-5 py-3 text-sm font-bold" onClick={() => setUsernameOpen(false)}>
                Later
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
