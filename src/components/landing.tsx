import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Dumbbell,
  Fingerprint,
  Timer,
  TrendingUp,
} from 'lucide-react';
import styles from './landing.module.css';

export function Landing() {
  return (
    <div className={styles.site}>
      <a href="#content" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="Auctus home">
          AUCTUS<span>/</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#experience">The experience</a>
          <a href="#details">Built for training</a>
        </nav>
        <Link href="/login" className={styles.navSignIn}>
          Sign in
          <ArrowUpRight size={16} />
        </Link>
      </header>
      <main id="content">
        <section className={styles.hero}>
          <Image
            src="/showcase/training-hero.webp"
            alt="Dumbbells ready for a focused strength training session"
            fill
            priority
            sizes="100vw"
            className={styles.heroPhoto}
          />
          <div className={styles.heroShade} />
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>A MORE INTENTIONAL WAY TO TRAIN</p>
            <h1>
              Put in the work.
              <br />
              <span>See your progress.</span>
            </h1>
            <p className={styles.heroDescription}>
              Plan your week. Own every set. Turn the effort you put in into progress you can see.
            </p>
            <div className={styles.heroActions}>
              <Link href="/login" className={styles.primaryLink}>
                Explore Auctus
                <ArrowUpRight size={19} />
              </Link>
              <a href="#experience" className={styles.textLink}>
                See how it works
                <ArrowRight size={18} />
              </a>
            </div>
          </div>
        </section>
        <div className={styles.principles}>
          <span>
            <Dumbbell size={18} />
            Your program, your way
          </span>
          <span>
            <Timer size={18} />
            Every set, accounted for
          </span>
          <span>
            <TrendingUp size={18} />
            Progress you can follow
          </span>
        </div>
        <section id="experience" className={styles.experience}>
          <div className={styles.sectionIntro}>
            <h2>
              Less friction.
              <br />
              <span>More focus.</span>
            </h2>
            <p>
              From your first warm-up to your last rep, everything has its place. So you can stay in
              the session.
            </p>
          </div>
          <div className={styles.productStage}>
            <div className={styles.productFrame}>
              <div className={styles.frameBar}>
                <span>AUCTUS / YOUR TRAINING JOURNAL</span>
                <span>Desktop overview</span>
              </div>
              <Image
                src="/showcase/overview.webp"
                unoptimized
                width={1440}
                height={1000}
                alt="Auctus overview with weekly workouts and training metrics, showing fictional demo data"
                sizes="(max-width: 760px) 100vw, 1100px"
              />
            </div>
            <p className={styles.imageCaption}>
              A clear view of your week. Illustrated with sample training data.
            </p>
          </div>
          <div className={styles.featureSteps}>
            <article>
              <span>01</span>
              <h3>Build your week.</h3>
              <p>Create your program, choose your exercises, and give every workout a purpose.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Find your rhythm.</h3>
              <p>Log weights and reps, follow your rest timer, and pick up where you left off.</p>
            </article>
            <article>
              <span>03</span>
              <h3>See what adds up.</h3>
              <p>
                Look back at your sessions and follow your strength, volume, and consistency over
                time.
              </p>
            </article>
          </div>
        </section>
        <section id="details" className={styles.details}>
          <div className={styles.detailCopy}>
            <h2>
              The details make
              <br />
              <span>the difference.</span>
            </h2>
            <p>Built around the way training actually happens.</p>
            <ul>
              <li>
                <Check size={18} />
                <div>
                  <h3>Your last set, remembered.</h3>
                  <p>
                    Previous weights and reps are ready for your next set. Spend less time typing
                    between lifts.
                  </p>
                </div>
              </li>
              <li>
                <Check size={18} />
                <div>
                  <h3>A plan that can adapt.</h3>
                  <p>
                    Equipment taken? Switch an exercise in your session without rewriting your whole
                    program.
                  </p>
                </div>
              </li>
              <li>
                <Check size={18} />
                <div>
                  <h3>Room for real life.</h3>
                  <p>Pause, return, and keep going. Your saved workout is there when you are.</p>
                </div>
              </li>
            </ul>
          </div>
          <div className={styles.phoneStage}>
            <div className={styles.phone}>
              <Image
                src="/showcase/session.webp"
                unoptimized
                width={390}
                height={844}
                alt="Auctus on a phone, with the current exercise, set controls and rest timer"
                sizes="330px"
              />
            </div>
            <span className={styles.phoneCaption}>At home on your phone.</span>
          </div>
        </section>
        <section className={styles.privacy}>
          <Fingerprint size={46} strokeWidth={1.2} />
          <div>
            <h2>Your training. Your space.</h2>
            <p>
              Your workouts and progress belong to your account. A private space to build
              consistency, with secure sign-in for peace of mind.
            </p>
          </div>
          <Link href="/login/account" className={styles.textLink}>
            Account sign-in
            <ArrowUpRight size={18} />
          </Link>
        </section>
        <section className={styles.faq} aria-labelledby="faq-heading">
          <h2 id="faq-heading">A few things to know.</h2>
          <div>
            {[
              [
                'What can I try in the showcase?',
                'Explore a complete training journal with a sample program, exercises, and workout history. Start a workout, log sets, or adjust the program. You get your own temporary copy, so your changes only affect your visit.',
              ],
              [
                'Do I need to create an account?',
                'No. Enter the showcase code you received to begin. Your demo lasts two hours and its data is then removed. Account management, background notifications, and AI features are not included in the showcase.',
              ],
              [
                'Can I use Auctus on my phone?',
                'Yes. Auctus adapts to your phone, tablet, and desktop. Existing account holders can also add it to their home screen. An internet connection is required to save changes.',
              ],
              [
                'How do I sign in to my existing account?',
                'Choose “Sign in to your account” on the sign-in page. Your email and password login stays the same. Master accounts then verify their passkey.',
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={18} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className={styles.closing}>
          <p className={styles.eyebrow}>CONSISTENCY COMPOUNDS.</p>
          <h2>
            Your next chapter
            <br />
            starts with <span>one session.</span>
          </h2>
          <Link href="/login" className={styles.primaryLink}>
            Explore Auctus
            <ArrowUpRight size={19} />
          </Link>
        </section>
      </main>
      <footer className={styles.footer}>
        <Link href="/" className={styles.wordmark}>
          AUCTUS<span>/</span>
        </Link>
        <span>A little stronger, every day.</span>
        <Link href="/login/account">
          Account sign-in
          <ArrowUpRight size={15} />
        </Link>
      </footer>
    </div>
  );
}
