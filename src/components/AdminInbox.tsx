'use client';

import { defaultHomeConfig, ensureAnonymousUser, saveHomeConfig, subscribeToConversations, subscribeToHomeConfig } from '@/lib/firebase/data';
import type { Conversation, HomeInterfaceConfig } from '@/lib/types';
import { Inbox, LayoutPanelTop, Save, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

function WebsiteInterfaceEditor() {
  const [config, setConfig] = useState<HomeInterfaceConfig>(defaultHomeConfig);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    ensureAnonymousUser()
      .then(() => {
        unsubscribe = subscribeToHomeConfig(setConfig);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load website interface.'));
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  function updateField<K extends keyof HomeInterfaceConfig>(key: K, value: HomeInterfaceConfig[K]) {
    setSaved(false);
    setConfig((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      await saveHomeConfig(config);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save website interface.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_.9fr]">
      <div className="kiaro-card p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-black">Website interface</h2>
            <p className="mt-2 text-sm leading-6 text-kiaro-muted">Edit the public landing page copy without changing code.</p>
          </div>
          <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm">
            <Save size={16} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {saved ? <div className="mb-4 rounded-2xl border border-kiaro-lime/25 bg-kiaro-lime/10 p-4 text-sm text-kiaro-lime">Saved.</div> : null}
        {error ? <div className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-kiaro-muted">
            Eyebrow
            <input className="glass-input px-4 py-3 text-kiaro-text" value={config.eyebrow} onChange={(event) => updateField('eyebrow', event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-kiaro-muted">
            Hero title
            <textarea className="glass-input min-h-28 px-4 py-3 text-kiaro-text" value={config.title} onChange={(event) => updateField('title', event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-kiaro-muted">
            Hero subtitle
            <textarea className="glass-input min-h-28 px-4 py-3 text-kiaro-text" value={config.subtitle} onChange={(event) => updateField('subtitle', event.target.value)} />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-kiaro-muted">
              Google button
              <input className="glass-input px-4 py-3 text-kiaro-text" value={config.googleButton} onChange={(event) => updateField('googleButton', event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-bold text-kiaro-muted">
              Guest button
              <input className="glass-input px-4 py-3 text-kiaro-text" value={config.guestButton} onChange={(event) => updateField('guestButton', event.target.value)} />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-bold text-kiaro-muted">
            Guest panel title
            <input className="glass-input px-4 py-3 text-kiaro-text" value={config.guestTitle} onChange={(event) => updateField('guestTitle', event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-kiaro-muted">
            Guest helper
            <textarea className="glass-input min-h-24 px-4 py-3 text-kiaro-text" value={config.guestHelper} onChange={(event) => updateField('guestHelper', event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-kiaro-muted">
            Access key helper
            <textarea className="glass-input min-h-24 px-4 py-3 text-kiaro-text" value={config.accessHelper} onChange={(event) => updateField('accessHelper', event.target.value)} />
          </label>
        </div>
      </div>

      <div className="kiaro-card overflow-hidden p-6">
        <div className="mb-5 text-xs font-bold uppercase tracking-[0.24em] text-kiaro-muted">Live preview</div>
        <div className="rounded-[28px] border border-white/10 bg-black/20 p-6">
          <div className="inline-flex rounded-full border border-kiaro-neon/20 bg-kiaro-neon/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-kiaro-neon">
            {config.eyebrow}
          </div>
          <h3 className="mt-5 font-display text-4xl font-black leading-none">{config.title}</h3>
          <p className="mt-4 text-sm leading-6 text-kiaro-muted">{config.subtitle}</p>
          <div className="mt-6 grid gap-3">
            <div className="btn-primary px-5 py-3 text-center text-sm">{config.googleButton}</div>
            <div className="btn-ghost px-5 py-3 text-center text-sm font-bold">{config.guestButton}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminInbox() {
  const [secret, setSecret] = useState('');
  const [entered, setEntered] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'inbox' | 'website'>('inbox');

  useEffect(() => {
    const saved = localStorage.getItem('kiaro.adminSecret');
    if (saved) {
      setSecret(saved);
      setEntered(true);
    }
  }, []);

  useEffect(() => {
    if (!entered || !secret) return undefined;
    let unsubscribe: (() => void) | undefined;

    async function load() {
      try {
        await ensureAnonymousUser();
        unsubscribe = subscribeToConversations((nextConversations) => {
          setConversations(nextConversations);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load inbox.');
      }
    }

    load();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [entered, secret]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const guest = c.guest_sessions;
      return [c.title, c.status, guest?.name, guest?.email, guest?.access_key].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [conversations, query]);

  async function enter() {
    setError('');
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret })
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error || 'Invalid admin secret.');
      return;
    }

    localStorage.setItem('kiaro.adminSecret', secret);
    setEntered(true);
  }

  if (!entered) {
    return (
      <div className="mx-auto max-w-xl px-5 py-20">
        <div className="kiaro-card p-7">
          <h1 className="font-display text-3xl font-black">Admin access</h1>
          <p className="mt-3 text-sm leading-6 text-kiaro-muted">Enter the admin secret from your Vercel environment variables.</p>
          {error ? <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
          <input className="glass-input mt-6 w-full px-4 py-4" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="ADMIN_SECRET" />
          <button className="btn-primary mt-4 w-full px-5 py-4 text-sm" onClick={enter}>Open admin console</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 pb-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-kiaro-neon/20 bg-kiaro-neon/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-kiaro-neon">
            <Inbox size={15} /> Admin console
          </div>
          <h1 className="font-display text-5xl font-black">Kiaro commissions</h1>
        </div>
        {tab === 'inbox' ? (
          <label className="glass-input flex min-w-72 items-center gap-3 px-4 py-3">
            <Search size={18} className="text-kiaro-muted" />
            <input className="w-full bg-transparent outline-none" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search inbox…" />
          </label>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <button onClick={() => setTab('inbox')} className={tab === 'inbox' ? 'btn-primary px-5 py-3 text-sm' : 'btn-ghost px-5 py-3 text-sm font-bold'}>
          Inbox
        </button>
        <button onClick={() => setTab('website')} className={tab === 'website' ? 'btn-primary px-5 py-3 text-sm' : 'btn-ghost inline-flex items-center gap-2 px-5 py-3 text-sm font-bold'}>
          <LayoutPanelTop size={16} /> Website interface
        </button>
      </div>

      {error ? <div className="mb-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      {tab === 'website' ? (
        <WebsiteInterfaceEditor />
      ) : (
        <div className="grid gap-3">
          {filtered.map((conversation) => {
            const guest = conversation.guest_sessions;
            return (
              <Link key={conversation.id} href={`/admin/${conversation.id}`} className="kiaro-card kiaro-hover block p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="font-display text-xl font-black">{guest?.name || 'Unnamed client'}</div>
                    <div className="mt-1 text-sm text-kiaro-muted">{guest?.email || 'No email'} · {guest?.access_key || 'No key'}</div>
                  </div>
                  <div className="text-right">
                    <div className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-kiaro-muted">{conversation.status}</div>
                    <div className="mt-2 text-xs text-kiaro-muted">Updated {new Date(conversation.updated_at).toLocaleString()}</div>
                  </div>
                </div>
              </Link>
            );
          })}

          {!filtered.length ? <div className="kiaro-card p-8 text-center text-sm text-kiaro-muted">No conversations yet.</div> : null}
        </div>
      )}
    </div>
  );
}
