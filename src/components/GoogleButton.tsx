'use client';

import { signInWithGoogle } from '@/lib/firebase/data';

export function GoogleButton() {
  async function login() {
    await signInWithGoogle();
    window.location.reload();
  }

  return (
    <button type="button" onClick={login} className="btn-ghost px-5 py-3 text-sm font-bold">
      Continue with Google
    </button>
  );
}
