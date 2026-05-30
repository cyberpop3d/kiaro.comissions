'use client';

import { createClient } from '@/lib/supabase/client';

export function GoogleButton() {
  async function login() {
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${siteUrl}/auth/callback`
      }
    });
  }

  return (
    <button type="button" onClick={login} className="btn-ghost px-5 py-3 text-sm font-bold">
      Continue with Google
    </button>
  );
}
