import { AdminInbox } from '@/components/AdminInbox';
import { TopNav } from '@/components/TopNav';

export default function AdminPage() {
  return (
    <main className="min-h-screen">
      <TopNav right={<a href="/" className="btn-ghost px-5 py-3 text-sm font-bold">Portal</a>} />
      <AdminInbox />
    </main>
  );
}
