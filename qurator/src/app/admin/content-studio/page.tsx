import { QueueTable } from '@/components/content-studio/queue-table';
import { requireAdminUser } from '@/lib/admin';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ContentStudioPage() {
  const admin = await requireAdminUser();
  if (!admin) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <ShieldAlert className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-foreground mb-2">Admin only</h1>
        <p className="text-sm text-foreground-muted mb-6">You need an admin account to view Content Studio.</p>
        <Link href="/" className="text-sm text-accent hover:underline">Back home</Link>
      </div>
    );
  }
  return <QueueTable adminId={admin.id} />;
}
