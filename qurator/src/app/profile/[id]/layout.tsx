import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', id)
      .single();

    if (!profile) return {};

    const title = `${profile.display_name}'s Tutorials`;
    const description = `Browse interactive tutorials created by ${profile.display_name} on Qurator.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://qurator.quobby.com/profile/${id}`,
        type: 'profile',
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
      robots: { index: false, follow: true },
    };
  } catch {
    return {};
  }
}

export default function ProfileLayout({ children }: Props) {
  return children;
}
