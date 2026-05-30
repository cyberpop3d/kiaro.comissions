import type { Offer } from '@/lib/types';

export function OfferCard({ offer, admin = false, onPaid }: { offer: Offer; admin?: boolean; onPaid?: () => void }) {
  return (
    <div className="rounded-3xl border border-kiaro-neon/25 bg-kiaro-panel2 p-5 shadow-glow">
      <div className="mb-1 text-xs font-bold uppercase tracking-[0.28em] text-kiaro-neon">Custom Order Offer</div>
      <div className="font-display text-3xl font-black">
        {offer.currency} ${Number(offer.amount).toFixed(2)}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-kiaro-text/85">{offer.scope}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a className="btn-primary px-5 py-3 text-sm" href={offer.payment_url} target="_blank" rel="noreferrer">
          Accept & Pay
        </a>
        <span className="rounded-full border border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-kiaro-muted">
          {offer.status}
        </span>
        {admin && offer.status !== 'paid' && onPaid ? (
          <button type="button" onClick={onPaid} className="btn-ghost px-4 py-3 text-xs font-bold uppercase tracking-[0.14em]">
            Mark paid
          </button>
        ) : null}
      </div>
    </div>
  );
}
