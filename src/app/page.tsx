'use client';

import { GoogleButton } from '@/components/GoogleButton';
import { TopNav } from '@/components/TopNav';
import { resumeConversation, startConversation } from '@/lib/firebase/data';
import { ArrowRight, FileArchive, Image, MessageSquarePlus, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [resumeKey, setResumeKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stored, setStored] = useState<{ id: string; key: string } | null>(null);

  useEffect(() => {
    const id = localStorage.getItem('kiaro.conversationId');
    const key = localStorage.getItem('kiaro.accessKey');
    if (id && key) setStored({ id, key });
  }, []);

  async function createConversation() {
    setBusy(true);
    setError('');
    try {
      const result = await startConversation({ name, email });
      localStorage.setItem('kiaro.conversationId', result.conversationId);
      localStorage.setItem('kiaro.accessKey', result.accessKey);
      router.push(`/chat/${result.conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start conversation.');
    } finally {
      setBusy(false);
    }
  }

  async function continueConversation() {
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

      <section className="mx-auto grid max-w-7xl gap-8 px-5 pt-8 lg:grid-cols-[1.05fr_.95fr] lg:pt-14">
        <div className="space-y-7">
          <div className="inline-flex rounded-full border border-kiaro-neon/20 bg-kiaro-neon/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-kiaro-neon">
            Private commission portal
          </div>
          <h1 className="font-display text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
            Share references, files and visual notes with Kiaro Studio.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-kiaro-muted">
            Start a direct project conversation without a forced questionnaire. Upload concept art, failed print photos, ZIP/STL files, and mark up images visually.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: MessageSquarePlus, title: 'Start conversation', text: 'Open a private thread with an access key.' },
              { icon: Image, title: 'Image library', text: 'Keep references and marked-up notes together.' },
              { icon: FileArchive, title: 'File library', text: 'Send ZIP, STL, 3MF, PDF and more.' }
            ].map((item) => (
              <div key={item.title} className="kiaro-card kiaro-hover p-5">
                <item.icon className="text-kiaro-neon" size={22} />
                <div className="mt-5 font-display text-lg font-black">{item.title}</div>
                <p className="mt-2 text-sm leading-6 text-kiaro-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="kiaro-card p-6 md:p-8">
          <h2 className="font-display text-3xl font-black">Create or continue</h2>
          <p className="mt-3 text-sm leading-6 text-kiaro-muted">
            No account required. Save the access key after starting, or use Google login when you want a persistent account later.
          </p>

          {error ? <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

          {stored ? (
            <button onClick={() => router.push(`/chat/${stored.id}`)} className="btn-primary mt-6 flex w-full items-center justify-center gap-2 px-5 py-4 text-sm">
              Continue saved conversation <ArrowRight size={16} />
            </button>
          ) : null}

          <div className="mt-6 grid gap-3">
            <input className="glass-input px-4 py-4" placeholder="Name / studio name optional" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="glass-input px-4 py-4" placeholder="Email optional" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button disabled={busy} onClick={createConversation} className="btn-primary flex items-center justify-center gap-2 px-5 py-4 text-sm">
              Start conversation <ArrowRight size={16} />
            </button>
          </div>

          <div className="my-7 h-px bg-white/10" />

          <div className="grid gap-3">
            <input className="glass-input px-4 py-4 uppercase" placeholder="Access key, e.g. KIA-ABCD-1234" value={resumeKey} onChange={(e) => setResumeKey(e.target.value.toUpperCase())} />
            <button disabled={busy || !resumeKey.trim()} onClick={continueConversation} className="btn-ghost px-5 py-4 text-sm font-bold">
              Resume with access key
            </button>
          </div>

          <div className="my-7 h-px bg-white/10" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <GoogleButton />
            <div className="flex items-center gap-2 text-xs text-kiaro-muted">
              <ShieldCheck size={16} className="text-kiaro-lime" /> Account login is optional.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
