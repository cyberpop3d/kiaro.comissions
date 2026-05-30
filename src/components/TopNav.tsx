import Link from 'next/link';

export function TopNav({ right }: { right?: React.ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6">
      <Link href="/" className="group flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-[16px] border border-white/15 bg-white/[0.04]">
          <span className="font-display text-lg font-black tracking-widest text-kiaro-text">K</span>
        </div>
        <div>
          <div className="font-display text-xl font-black uppercase tracking-[0.22em] text-kiaro-text">Kiaro Studio</div>
          <div className="text-xs uppercase tracking-[0.32em] text-kiaro-muted">Commissions</div>
        </div>
      </Link>
      {right}
    </header>
  );
}
