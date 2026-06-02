'use client';

import { useEffect, useRef } from 'react';

function conversationIdFromPath() {
  const match = window.location.pathname.match(/^\/chat\/([^/]+)/);
  return match?.[1] || '';
}

function clean(value: string) {
  return value.trim().slice(0, 4000);
}

export function CommissionNotificationBridge() {
  const lastSentRef = useRef('');

  useEffect(() => {
    function notifyFromComposer() {
      const conversationId = conversationIdFromPath();
      if (!conversationId) return;

      const textarea = document.querySelector('textarea.glass-input') as HTMLTextAreaElement | null;
      const body = clean(textarea?.value || '');
      if (!body) return;

      const dedupeKey = `${conversationId}:${body}`;
      if (lastSentRef.current === dedupeKey) return;
      lastSentRef.current = dedupeKey;

      window.setTimeout(() => {
        fetch('/api/admin/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'message',
            name: 'Commission client',
            conversationId,
            body,
            url: `${window.location.origin}/admin/${conversationId}`
          })
        }).catch(() => undefined);
      }, 450);
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button) return;
      if (!window.location.pathname.startsWith('/chat/')) return;
      if (button.querySelector('svg') && button.className.includes('btn-primary') && button.className.includes('h-12')) notifyFromComposer();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!window.location.pathname.startsWith('/chat/')) return;
      if (event.key !== 'Enter' || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName.toLowerCase() === 'textarea') notifyFromComposer();
    }

    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  return null;
}
