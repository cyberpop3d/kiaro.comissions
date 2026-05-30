'use client';

import { ensureAnonymousUser, subscribeToConversations } from '@/lib/firebase/data';
import type { Conversation } from '@/lib/types';
import { Inbox, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

export function AdminInbox() {
  const [secret, setSecret] = useState('');
  const [entered, setEntered] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

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
          <p className="mt-3 text-sm leading-6 text-kiaro-muted">Enter the MVP admin secret from your Vercel environment variables. This protects the admin UI; production Firestore rules should still be tightened later.</p>
          {error ? <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
          <input className="glass-input mt-6 w-full px-4 py-4" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="ADMIN_SECRET" />
          <button className="btn-primary mt-4 w-full px-5 py-4 text-sm" onClick={enter}>Open inbox</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 pb-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-kiaro-neon/20 bg-kiaro-neon/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-kiaro-neon">
            <Inbox size={15} /> Admin inbox
          </div>
          <h1 className="font-display text-5xl font-black">Customer conversations</h1>
        </div>
        <label className="glass-input flex min-w-72 items-center gap-3 px-4 py-3">
          <Search size={18} className="text-kiaro-muted" />
          <input className="w-full bg-transparent outline-none" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search inbox…" />
        </label>
      </div>

      {error ? <div className="mb-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <div className="grid gap-3">
        {filtered.map((conversation) => {
          const guest = conversation.guest_sessions;
          return (
            <Link key={conversation.id} href={`/admin/${conversation.id}`} className="kiaro-card kiaro-hover block p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-display text-xl font-black">{guest?.name || 'Guest customer'}</div>
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

        {!filtered.length ? (
          <div className="kiaro-card p-8 text-center text-sm text-kiaro-muted">No conversations yet.</div>
        ) : null}
      </div>
    </div>
  );
}
