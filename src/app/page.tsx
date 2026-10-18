import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/server/auth';
export const dynamic='force-dynamic';
export default async function Home(){const session=await getAuth().api.getSession({headers:await headers()});if(!session)redirect('/login');return <main className="login stack"><div className="brand">AUCTUS<span> /</span></div><h1>Your training starts here.</h1><p>Your private workspace is ready.</p></main>;}
