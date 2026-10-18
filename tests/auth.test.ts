import { describe, it, expect } from 'vitest';
import { openDatabase } from '../src/server/db/connection';
import { createAuth } from '../src/server/auth';
import { provisionOwner } from '../src/server/owner';

describe('private account', () => {
  it('rejects registration, authenticates the provisioned owner and revokes sessions on password recovery', async () => {
    const store = openDatabase(':memory:');
    const password = 'test-only-password-for-auth';
    await provisionOwner(store, 'owner@example.test', password);
    const auth = createAuth(store, 'a-test-only-secret-of-at-least-32-characters', 'http://localhost:3000');
    const post = (route:string, body:unknown) => auth.handler(new Request('http://localhost:3000/api/auth/'+route,{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:3000'},body:JSON.stringify(body)}));
    expect((await post('sign-up/email',{email:'other@example.test',password,name:'Other'})).status).toBeGreaterThanOrEqual(400);
    const signIn = await post('sign-in/email',{email:'owner@example.test',password});
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly');
    const before = await auth.api.getSession({headers:new Headers({cookie})});
    expect(before?.user.email).toBe('owner@example.test');
    await provisionOwner(store, 'owner@example.test', 'a-new-test-only-password');
    expect(await auth.api.getSession({headers:new Headers({cookie})})).toBeNull();
    expect((await post('sign-in/email',{email:'owner@example.test',password})).status).toBe(401);
    store.sqlite.close();
  });
});
