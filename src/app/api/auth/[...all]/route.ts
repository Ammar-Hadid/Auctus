import { getAuth } from '@/server/auth';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (new URL(request.url).pathname !== '/api/auth/get-session')
    return new Response(null, { status: 404 });
  return getAuth().handler(request);
}
export async function POST(request: Request) {
  if (!['/api/auth/sign-in/email', '/api/auth/sign-out'].includes(new URL(request.url).pathname))
    return new Response(null, { status: 404 });
  return getAuth().handler(request);
}
