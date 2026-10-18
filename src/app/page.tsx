import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/server/auth';
import { getStore } from '@/server/db/connection';
import { readState } from '@/server/read-state';
import { App } from '@/components/app';
export const dynamic='force-dynamic';
export default async function Home(){const session=await getAuth().api.getSession({headers:await headers()});if(!session)redirect('/login');return <App initial={readState(getStore())}/>;}
