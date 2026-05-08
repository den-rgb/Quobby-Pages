import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/categories?select=*&order=sort_order`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      },
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: body }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
