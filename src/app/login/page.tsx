import { ShowcaseLogin } from '@/components/showcase-login';
import { showcaseCodeHash } from '@/server/showcase';
import type { Metadata } from 'next';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Sign in · Auctus',
  robots: { index: false, follow: false },
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const params = await searchParams;
  return <ShowcaseLogin available={!!showcaseCodeHash()} expired={params.expired === '1'} />;
}
