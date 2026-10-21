'use client';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, KeyRound, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import styles from './landing.module.css';
export function ShowcaseLogin({ available, expired }: { available: boolean; expired: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/showcase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enter', code: data.get('code') }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to open the showcase. Please retry.');
      location.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to connect. Please retry.');
      setBusy(false);
    }
  }
  return (
    <main className={`${styles.site} ${styles.loginPage}`}>
      <Link href="/" className={styles.wordmark}>
        AUCTUS<span>/</span>
      </Link>
      <div className={styles.loginGrid}>
        <section className={styles.loginIntro}>
          <span className={styles.eyebrow}>YOUR NEXT SESSION STARTS HERE</span>
          <h1>
            A little stronger.
            <br />
            <span>Every day.</span>
          </h1>
          <p>
            A thoughtful space for your training.
            <br />
            Step inside and make yourself at home.
          </p>
          <div className={styles.loginPhoto} />
        </section>
        <section className={styles.loginPanel} aria-labelledby="showcase-heading">
          <KeyRound size={24} className={styles.accentIcon} />
          <h2 id="showcase-heading">Take a closer look.</h2>
          <p>
            Enter your showcase code to explore Auctus with your own temporary training journal.
          </p>
          {expired && (
            <p role="status" className={styles.notice}>
              Your demo has expired. Enter your code for a fresh start.
            </p>
          )}
          <form onSubmit={submit} className={styles.loginForm}>
            <label htmlFor="showcase-code">Showcase code</label>
            <input
              id="showcase-code"
              name="code"
              type="password"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={128}
              placeholder="Enter your access code"
              disabled={busy || !available}
              aria-describedby={error ? 'login-error' : 'demo-details'}
            />
            {error && (
              <p id="login-error" role="alert" className={styles.error}>
                {error}
              </p>
            )}
            {!available && (
              <p role="status" className={styles.notice}>
                Showcase access is not available right now. Existing accounts can still sign in
                below.
              </p>
            )}
            <button className={styles.primaryLink} disabled={busy || !available}>
              {busy ? 'Preparing your journal…' : 'Enter showcase'}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className={styles.loginDetails} id="demo-details">
            <ShieldCheck size={18} />
            <p>
              Fictional data. Your own space. Two hours to explore.
              <br />
              No personal details needed.
            </p>
          </div>
          <div className={styles.accountLink}>
            <span>Already have an account?</span>
            <Link href="/login/account">
              Sign in to your account
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
      </div>
      <footer className={styles.loginFooter}>
        AUCTUS <span>Consistency compounds.</span>
        <Link href="/">Back to Auctus</Link>
      </footer>
    </main>
  );
}
