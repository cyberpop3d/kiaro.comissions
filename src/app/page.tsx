'use client';

import { GoogleButton } from '@/components/GoogleButton';
import { TopNav } from '@/components/TopNav';
import { defaultHomeConfig, ensureAnonymousUser, getOrCreateGoogleConversation, resumeConversation, startConversation, subscribeToHomeConfig, waitForAuthUser } from '@/lib/firebase/data';
import type { HomeInterfaceConfig } from '@/lib/types';
import { ArrowRight, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const [config, setConfig] = useState<HomeInterfaceConfig>(defaultHomeConfig);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeKey, setResumeKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkingUser, setCheckingUser] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    ensureAnonymousUser()
      .then(() => {
        unsubscribe = subscribeToHomeConfig(setConfig);
      })
      .catch(() => undefined);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function autoOpenGoogleConversation() {
      const user = await waitForAuthUser();
      if (cancelled) return;
      if (user && !user.isAnonymous) {
        try {
          const result = await getOrCreateGoogleConversation();
          router.replace(`/chat/${result.conversationId}`);
          return;
        } catch {
          // Keep the page usable if Google session exists but Firestore is not ready yet.
        }
      }
      setCheckingUser(false);
    }

    autoOpenGoogleConversation();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function continueAsGuest() {
    const name = guestName.trim();
    if (!name) {
      setError('Please choose a username before continuing without registration.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await startConversation({ name });
      localStorage.setItem('kiaro.conversationId', result.conversationId);
      localStorage.setItem('kiaro.accessKey', result.accessKey);
      localStorage.setItem(`kiaro.usernamePrompt.${result.conversationId}`, 'done');
      router.push(`/chat/${result.conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start conversation.');
    } finally {
      setBusy(false);
    }
  }

  async function continueWithKey() {
    if (!resumeKey.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await resumeConversation(resumeKey);
      localStorage.setItem('kiaro.conversationId', result.conversationId);
      localStorage.setItem('kiaro.accessKey', result.accessKey);
      router.push(`/chat/${result.conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resume conversation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen pb-16">
      <TopNav />

      <section className="mx-auto grid max-w-7xl gap-8 px-5 pt-8 lg:grid-cols-[1.08fr_.92fr] lg:pt-16">
        <div className="flex min-h-[58vh] flex-col justify-center space-y-7">
          <div className="inline-flex w-fit rounded-full border border-kiaro-neon/20 bg-kiaro-neon/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-kiaro-neon">
            {config.eyebrow}
          </div>
          <h1 className="max-w-4xl font-display text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
            {config.title}
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-kiaro-muted">{config.subtitle}</p>
        </div>

        <div className="kiaro-card self-center p-6 md:p-8">
          <h2 className="font-display text-3xl font-black">Start your commission thread</h2>
          <p className="mt-3 text-sm leading-6 text-kiaro-muted">
            Sign in with Google, or continue without registration and save the access key you receive.
          </p>

          {error ? <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

          <div className="mt-7 grid gap-3">
            <GoogleButton label={checkingUser ? 'Checking Google session…' : config.googleButton} className="w-full" />
            <button type="button" onClick={() => setGuestOpen((value) => !value)} className="btn-ghost flex w-full items-center justify-center gap-2 px-6 py-4 text-sm font-black">
              {config.guestButton} <ArrowRight size={16} />
            </button>
          </div>

          {guestOpen ? (
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <h3 className="font-display text-xl font-black">{config.guestTitle}</h3>
              <p className="mt-2 text-sm leading-6 text-kiaro-muted">{config.guestHelper}</p>
              <input
                className="glass-input mt-4 w-full px-4 py-4"
                placeholder="Username / studio name"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') continueAsGuest();
                }}
              />
              <button disabled={busy} onClick={continueAsGuest} className="btn-primary mt-3 w-full px-6 py-4 text-sm font-black">
                Enter chat
              </button>
            </div>
          ) : null}

          <div className="mt-7 border-t border-white/10 pt-5">
            <button type="button" onClick={() => setResumeOpen((value) => !value)} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-kiaro-muted hover:text-kiaro-neon">
              <KeyRound size={15} /> Resume with access key
            </button>
            {resumeOpen ? (
              <div className="mt-4 grid gap-3">
                <p className="text-sm leading-6 text-kiaro-muted">{config.accessHelper}</p>
                <input className="glass-input px-4 py-4 uppercase" placeholder="KIA-ABCD-1234" value={resumeKey} onChange={(e) => setResumeKey(e.target.value.toUpperCase())} />
                <button disabled={busy || !resumeKey.trim()} onClick={continueWithKey} className="btn-ghost px-5 py-4 text-sm font-bold">
                  Continue existing thread
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
