'use client';

import { GoogleButton } from '@/components/GoogleButton';
import { TopNav } from '@/components/TopNav';
import { defaultDesignConfig, defaultHomeConfig, ensureAnonymousUser, getOrCreateGoogleConversation, resumeConversation, startConversation, subscribeToDesignConfig, subscribeToHomeConfig, waitForAuthUser } from '@/lib/firebase/data';
import type { DesignConfig, HomeInterfaceConfig } from '@/lib/types';
import { applyDesignConfig } from '@/utils/design';
import { ArrowRight, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const [config, setConfig] = useState<HomeInterfaceConfig>(defaultHomeConfig);
  const [designConfig, setDesignConfig] = useState<DesignConfig>(defaultDesignConfig);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeKey, setResumeKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkingUser, setCheckingUser] = useState(true);

  useEffect(() => {
    let unsubscribeHome: (() => void) | undefined;
    let unsubscribeDesign: (() => void) | undefined;
    ensureAnonymousUser()
      .then(() => {
        unsubscribeHome = subscribeToHomeConfig(setConfig);
        unsubscribeDesign = subscribeToDesignConfig(setDesignConfig);
      })
      .catch(() => undefined);
    return () => {
      if (unsubscribeHome) unsubscribeHome();
      if (unsubscribeDesign) unsubscribeDesign();
    };
  }, []);

  useEffect(() => {
    applyDesignConfig(designConfig);
  }, [designConfig]);

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
          // Keep landing usable if Firestore is temporarily unreachable.
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
      setError('Please choose a display name before continuing without registration.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await startConversation({ name });
      localStorage.setItem('kiaro.conversationId', result.conversationId);
      if (result.accessKey) localStorage.setItem('kiaro.accessKey', result.accessKey);
      localStorage.setItem(`kiaro.usernamePrompt.${result.conversationId}`, 'done');
      router.push(`/chat/${result.conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start workspace.');
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
      setError(err instanceof Error ? err.message : 'Could not resume guest workspace.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen pb-16">
      <TopNav />

      <section className="mx-auto grid max-w-6xl gap-8 px-5 pt-10 lg:grid-cols-[1.05fr_.95fr] lg:pt-20">
        <div className="flex min-h-[56vh] flex-col justify-center space-y-7">
          <div className="inline-flex w-fit rounded-full border border-white/14 bg-white/[0.035] px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-kiaro-muted">
            {config.eyebrow || 'Kiaro Studio Commissions'}
          </div>
          <h1 className="max-w-4xl font-display text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
            {config.title || 'Start a private commission workspace.'}
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-kiaro-muted">
            {config.subtitle || 'Discuss your project, share references, receive custom offers, and download final files in one clean workspace.'}
          </p>
          <div className="grid max-w-xl gap-3 text-sm text-kiaro-muted sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">Private chat</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">Reference markup</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">Final delivery</div>
          </div>
        </div>

        <div className="kiaro-card self-center p-6 md:p-8">
          <h2 className="font-display text-3xl font-black">Open your workspace</h2>
          <p className="mt-3 text-sm leading-6 text-kiaro-muted">
            Use Google for a persistent account, or continue without registration and save the access key you receive.
          </p>

          {error ? <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

          <div className="mt-7 grid gap-3">
            <GoogleButton label={checkingUser ? 'Checking Google session…' : config.googleButton || 'Sign in with Google'} className="w-full" />
            <button type="button" onClick={() => setGuestOpen((value) => !value)} className="btn-ghost flex w-full items-center justify-center gap-2 px-6 py-4 text-sm font-black">
              {config.guestButton || 'Continue without registration'} <ArrowRight size={16} />
            </button>
          </div>

          {guestOpen ? (
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <h3 className="font-display text-xl font-black">{config.guestTitle || 'Choose a display name'}</h3>
              <p className="mt-2 text-sm leading-6 text-kiaro-muted">
                {config.guestHelper || 'This name helps Kiaro Studio identify your request inside the workspace.'}
              </p>
              <input
                className="glass-input mt-4 w-full px-4 py-4"
                placeholder="Display name / studio name"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') continueAsGuest();
                }}
              />
              <button disabled={busy} onClick={continueAsGuest} className="btn-primary mt-3 w-full px-6 py-4 text-sm font-black">
                Enter workspace
              </button>
            </div>
          ) : null}

          <div className="mt-7 border-t border-white/10 pt-5">
            <button type="button" onClick={() => setResumeOpen((value) => !value)} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-kiaro-muted hover:text-kiaro-text">
              <KeyRound size={15} /> Already have a guest access key?
            </button>
            {resumeOpen ? (
              <div className="mt-4 grid gap-3">
                <p className="text-sm leading-6 text-kiaro-muted">{config.accessHelper || 'Resume an existing guest workspace with your saved key.'}</p>
                <input className="glass-input px-4 py-4 uppercase" placeholder="KIA-ABCD-1234" value={resumeKey} onChange={(e) => setResumeKey(e.target.value.toUpperCase())} />
                <button disabled={busy || !resumeKey.trim()} onClick={continueWithKey} className="btn-ghost px-5 py-4 text-sm font-bold">
                  Resume guest workspace
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
