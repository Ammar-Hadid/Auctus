import { getStore } from '@/server/db/connection';
import { dispatch } from '@/server/dispatch';
import { authorize,apiError } from '@/server/api';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{await authorize(request,true);const text=await request.text();if(text.length>300000)return Response.json({error:'Request is too large.'},{status:413});const result=dispatch(getStore(),JSON.parse(text));return Response.json({result},{headers:{'Cache-Control':'private, no-store'}});}catch(error){return apiError(error);}}
