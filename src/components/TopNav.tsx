import Link from 'next/link';

export function TopNav({ right }: { right?: React.ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6">
      <Link href="/" className="group flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-kiaro-neon/30 bg-kiaro-panel shadow-glow">
          <span className="font-display text-lg font-black tracking-widest text-kiaro-neon">K</span>
        </div>
        <div>
          <div className="font-display text-xl font-black uppercase tracking-[0.22em]">Kiaro Studio</div>
          <div className="text-xs uppercase tracking-[0.32em] text-kiaro-muted">Commissions</div>
        </div>
      </Link>
      {right}
    </header>
  );
}
