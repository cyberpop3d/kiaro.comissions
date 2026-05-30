'use client';

import {
  defaultChatConfig,
  defaultDesignConfig,
  defaultHomeConfig,
  ensureAnonymousUser,
  saveChatConfig,
  saveDesignConfig,
  saveHomeConfig,
  subscribeToChatConfig,
  subscribeToConversations,
  subscribeToDesignConfig,
  subscribeToHomeConfig
} from '@/lib/firebase/data';
import type { ChatInterfaceConfig, Conversation, DesignConfig, HomeInterfaceConfig } from '@/lib/types';
import { applyDesignConfig } from '@/utils/design';
import { Inbox, LayoutPanelTop, MessageSquareText, Palette, Save, Search, Type } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const paletteOptions: Array<{ value: DesignConfig['palette']; label: string }> = [
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'graphite', label: 'Graphite' },
  { value: 'warm', label: 'Warm studio' },
  { value: 'cyan', label: 'Cyan tech' },
  { value: 'mono', label: 'Mono' }
];

const fontOptions: Array<{ value: DesignConfig['fontFamily']; label: string }> = [
  { value: 'inter', label: 'Inter / Inter Tight' },
  { value: 'system', label: 'System UI' },
  { value: 'space', label: 'Space Grotesk' },
  { value: 'manrope', label: 'Manrope' },
  { value: 'archivo', label: 'Archivo' }
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-kiaro-muted">
      {label}
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <input className="glass-input px-4 py-3 text-kiaro-text" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
}

function TextArea({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <textarea className="glass-input min-h-24 px-4 py-3 text-kiaro-text" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
}

function SelectField<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <select className="glass-input px-4 py-3 text-kiaro-text" value={value} onChange={(event) => onChange(event.target.value as T)}>
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-black text-white">
          {option.label}
        </option>
      ))}
    </select>
  );
}

function DesignControls({ config, onChange }: { config: DesignConfig; onChange: (config: DesignConfig) => void }) {
  function update<K extends keyof DesignConfig>(key: K, value: DesignConfig[K]) {
    const next = { ...config, [key]: value };
    onChange(next);
    applyDesignConfig(next);
  }

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5">
      <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-kiaro-muted">
        <Palette size={15} /> UI, color palette and font settings
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Color palette">
          <SelectField value={config.palette} onChange={(value) => update('palette', value)} options={paletteOptions} />
        </Field>
        <Field label="Font type">
          <SelectField value={config.fontFamily} onChange={(value) => update('fontFamily', value)} options={fontOptions} />
        </Field>
        <Field label="Button style">
          <SelectField
            value={config.buttonStyle}
            onChange={(value) => update('buttonStyle', value)}
            options={[
              { value: 'pill', label: 'Pill' },
              { value: 'soft', label: 'Soft rounded' },
              { value: 'sharp', label: 'Sharp editorial' }
            ]}
          />
        </Field>
        <Field label="Card style">
          <SelectField
            value={config.cardStyle}
            onChange={(value) => update('cardStyle', value)}
            options={[
              { value: 'soft', label: 'Soft shadow' },
              { value: 'flat', label: 'Flat panel' },
              { value: 'editorial', label: 'Editorial edge' }
            ]}
          />
        </Field>
        <Field label="Background mode">
          <SelectField
            value={config.backgroundMode}
            onChange={(value) => update('backgroundMode', value)}
            options={[
              { value: 'subtle', label: 'Subtle depth' },
              { value: 'flat', label: 'Flat black' },
              { value: 'spotlight', label: 'Soft spotlight' }
            ]}
          />
        </Field>
        <Field label="Accent color">
          <input className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.035] p-2" type="color" value={config.accentColor} onChange={(event) => update('accentColor', event.target.value)} />
        </Field>
      </div>
    </div>
  );
}

function useDesignSettings() {
  const [design, setDesign] = useState<DesignConfig>(defaultDesignConfig);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    ensureAnonymousUser()
      .then(() => {
        unsubscribe = subscribeToDesignConfig((next) => {
          setDesign(next);
          applyDesignConfig(next);
        });
      })
      .catch(() => undefined);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return [design, setDesign] as const;
}

function WebsiteInterfaceEditor() {
  const [config, setConfig] = useState<HomeInterfaceConfig>(defaultHomeConfig);
  const [design, setDesign] = useDesignSettings();
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
      await Promise.all([saveHomeConfig(config), saveDesignConfig(design)]);
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
            <p className="mt-2 text-sm leading-6 text-kiaro-muted">Edit the public landing page copy, UI palette and font style without changing code.</p>
          </div>
          <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm">
            <Save size={16} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {saved ? <div className="mb-4 rounded-2xl border border-kiaro-lime/25 bg-kiaro-lime/10 p-4 text-sm text-kiaro-lime">Saved.</div> : null}
        {error ? <div className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

        <div className="grid gap-4">
          <Field label="Eyebrow"><TextInput value={config.eyebrow} onChange={(value) => updateField('eyebrow', value)} /></Field>
          <Field label="Hero title"><TextArea value={config.title} onChange={(value) => updateField('title', value)} /></Field>
          <Field label="Hero subtitle"><TextArea value={config.subtitle} onChange={(value) => updateField('subtitle', value)} /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Google button"><TextInput value={config.googleButton} onChange={(value) => updateField('googleButton', value)} /></Field>
            <Field label="Guest button"><TextInput value={config.guestButton} onChange={(value) => updateField('guestButton', value)} /></Field>
          </div>
          <Field label="Guest panel title"><TextInput value={config.guestTitle} onChange={(value) => updateField('guestTitle', value)} /></Field>
          <Field label="Guest helper"><TextArea value={config.guestHelper} onChange={(value) => updateField('guestHelper', value)} /></Field>
          <Field label="Access key helper"><TextArea value={config.accessHelper} onChange={(value) => updateField('accessHelper', value)} /></Field>
          <DesignControls config={design} onChange={setDesign} />
        </div>
      </div>

      <div className="kiaro-card overflow-hidden p-6">
        <div className="mb-5 text-xs font-bold uppercase tracking-[0.24em] text-kiaro-muted">Live preview</div>
        <div className="rounded-[28px] border border-white/10 bg-black/20 p-6">
          <div className="inline-flex rounded-full border border-white/14 bg-white/[0.035] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-kiaro-muted">
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

function ChatInterfaceEditor() {
  const [config, setConfig] = useState<ChatInterfaceConfig>(defaultChatConfig);
  const [design, setDesign] = useDesignSettings();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    ensureAnonymousUser()
      .then(() => {
        unsubscribe = subscribeToChatConfig(setConfig);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load chat interface.'));
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  function updateField<K extends keyof ChatInterfaceConfig>(key: K, value: ChatInterfaceConfig[K]) {
    setSaved(false);
    setConfig((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      await Promise.all([saveChatConfig(config), saveDesignConfig(design)]);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save chat interface.');
    } finally {
      setSaving(false);
    }
  }

  const fields: Array<[keyof ChatInterfaceConfig, string, 'input' | 'textarea']> = [
    ['projectConversationLabel', 'Conversation section label', 'input'],
    ['generalUploadsTitle', 'General uploads title', 'input'],
    ['generalUploadsDescription', 'General uploads description', 'textarea'],
    ['newProjectButton', 'New project button', 'input'],
    ['newProjectModalTitle', 'New project modal title', 'input'],
    ['newProjectModalBody', 'New project modal body', 'textarea'],
    ['projectNamePlaceholder', 'Project name placeholder', 'input'],
    ['createProjectButton', 'Create project button', 'input'],
    ['referencesTab', 'References tab', 'input'],
    ['filesTab', 'Files tab', 'input'],
    ['deliveryTab', 'Delivery tab', 'input'],
    ['offerTab', 'Offer tab', 'input'],
    ['messagePlaceholder', 'Message input placeholder', 'input'],
    ['dragHelp', 'Upload helper text', 'textarea'],
    ['dropTitle', 'Drag overlay title', 'input'],
    ['dropSingleFileText', 'Drag overlay single file text', 'textarea'],
    ['dropMultipleFilesText', 'Drag overlay multiple file suffix', 'input'],
    ['unsupportedFileText', 'Unsupported file warning', 'input'],
    ['noReferencesLabel', 'Empty references label', 'input'],
    ['noFilesLabel', 'Empty files label', 'input'],
    ['deliveryLockedTitle', 'Delivery locked title', 'input'],
    ['deliveryUnlockedTitle', 'Delivery unlocked title', 'input'],
    ['deliveryLockedBody', 'Delivery locked body', 'textarea'],
    ['deliveryUnlockedBody', 'Delivery unlocked body', 'textarea'],
    ['noFinalFilesLabel', 'Empty final files label', 'input'],
    ['offerPanelTitle', 'Offer panel title', 'input'],
    ['offerPanelHelper', 'Offer panel helper', 'textarea'],
    ['offerNoProjectWarning', 'Offer missing project warning', 'textarea'],
    ['offerAmountPlaceholder', 'Offer amount placeholder', 'input'],
    ['offerScopePlaceholder', 'Offer scope placeholder', 'input'],
    ['offerLinkPlaceholder', 'Offer link placeholder', 'input'],
    ['sendOfferButton', 'Send offer button', 'input'],
    ['paymentConfirmedLabel', 'Payment confirmed label', 'input'],
    ['waitingPaymentLabel', 'Waiting payment label', 'input'],
    ['guestKeyLabel', 'Guest key label', 'input'],
    ['loadingWorkspace', 'Loading text', 'input'],
    ['accessNeededTitle', 'Access needed title', 'input'],
    ['accessNeededBody', 'Access needed body', 'textarea'],
    ['fileAttachedBody', 'Attachment message body', 'input'],
    ['editImageButton', 'Edit image button', 'input'],
    ['addVariationTitle', 'Add variation tooltip', 'input'],
    ['usernameModalTitle', 'Username modal title', 'input'],
    ['usernameModalBody', 'Username modal body', 'textarea'],
    ['usernamePlaceholder', 'Username input placeholder', 'input'],
    ['saveUsernameButton', 'Save username button', 'input'],
    ['laterButton', 'Later button', 'input']
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_.75fr]">
      <div className="kiaro-card p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-black">Chat interface</h2>
            <p className="mt-2 text-sm leading-6 text-kiaro-muted">Edit the customer workspace labels, helper copy, upload text, payment labels and project wording.</p>
          </div>
          <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm">
            <Save size={16} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {saved ? <div className="mb-4 rounded-2xl border border-kiaro-lime/25 bg-kiaro-lime/10 p-4 text-sm text-kiaro-lime">Saved.</div> : null}
        {error ? <div className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
        <div className="grid gap-4">
          {fields.map(([key, label, type]) => (
            <Field key={String(key)} label={label}>
              {type === 'textarea' ? (
                <TextArea value={config[key]} onChange={(value) => updateField(key, value)} />
              ) : (
                <TextInput value={config[key]} onChange={(value) => updateField(key, value)} />
              )}
            </Field>
          ))}
          <DesignControls config={design} onChange={setDesign} />
        </div>
      </div>
      <div className="kiaro-card p-6">
        <div className="text-xs font-bold uppercase tracking-[0.24em] text-kiaro-muted">Workspace copy preview</div>
        <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.025] p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kiaro-muted">{config.projectConversationLabel}</div>
          <h3 className="mt-1 font-display text-3xl font-black">{config.generalUploadsTitle}</h3>
          <p className="mt-3 text-sm leading-6 text-kiaro-muted">{config.generalUploadsDescription}</p>
          <div className="mt-5 flex gap-2">
            {[config.referencesTab, config.filesTab, config.deliveryTab].map((label, index) => (
              <div key={label} className={index === 0 ? 'rounded-full border border-white/70 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-black' : 'rounded-full border border-white/10 bg-white/[0.025] px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-kiaro-muted'}>
                {label}
              </div>
            ))}
          </div>
          <div className="mt-5 glass-input px-4 py-3 text-sm text-kiaro-muted">{config.messagePlaceholder}</div>
        </div>
      </div>
    </div>
  );
}

function DesignSystemEditor() {
  const [design, setDesign] = useDesignSettings();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      await saveDesignConfig(design);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save design system.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
      <div className="kiaro-card p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-black">Design system</h2>
            <p className="mt-2 text-sm leading-6 text-kiaro-muted">Control the shared UI palette, font type, button style and card behavior for the public site and workspace.</p>
          </div>
          <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm">
            <Save size={16} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {saved ? <div className="mb-4 rounded-2xl border border-kiaro-lime/25 bg-kiaro-lime/10 p-4 text-sm text-kiaro-lime">Saved.</div> : null}
        {error ? <div className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
        <DesignControls config={design} onChange={setDesign} />
      </div>
      <div className="kiaro-card p-6">
        <div className="text-xs font-bold uppercase tracking-[0.24em] text-kiaro-muted">UI preview</div>
        <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.025] p-5">
          <h3 className="font-display text-4xl font-black leading-none">Kiaro Studio</h3>
          <p className="mt-3 text-sm leading-6 text-kiaro-muted">A compact preview of the selected palette, typography and interaction style.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn-primary px-5 py-3 text-sm">Primary action</button>
            <button className="btn-ghost px-5 py-3 text-sm font-bold">Secondary action</button>
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
  const [tab, setTab] = useState<'inbox' | 'website' | 'chat' | 'design'>('inbox');

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

  const navItems: Array<{ id: typeof tab; label: string; icon: ReactNode }> = [
    { id: 'inbox', label: 'Inbox', icon: <Inbox size={16} /> },
    { id: 'website', label: 'Website interface', icon: <LayoutPanelTop size={16} /> },
    { id: 'chat', label: 'Chat interface', icon: <MessageSquareText size={16} /> },
    { id: 'design', label: 'Design system', icon: <Type size={16} /> }
  ];

  return (
    <div className="mx-auto max-w-7xl px-5 pb-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.035] px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-kiaro-muted">
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
        {navItems.map((item) => (
          <button key={item.id} onClick={() => setTab(item.id)} className={cx(tab === item.id ? 'btn-primary' : 'btn-ghost', 'inline-flex items-center gap-2 px-5 py-3 text-sm font-bold')}>
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      {error ? <div className="mb-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      {tab === 'website' ? <WebsiteInterfaceEditor /> : null}
      {tab === 'chat' ? <ChatInterfaceEditor /> : null}
      {tab === 'design' ? <DesignSystemEditor /> : null}

      {tab === 'inbox' ? (
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
      ) : null}
    </div>
  );
}
