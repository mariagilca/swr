import {useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import BrowserOnly from '@docusaurus/BrowserOnly';
import styles from './index.module.css';

function HeroBackdrop() {
  return (
    <>
      <BrowserOnly>
        {() => {
          const HeroFluid = require('@site/src/components/HeroFluid').default;
          return <HeroFluid className={styles.heroFluid} />;
        }}
      </BrowserOnly>
      <div className={styles.heroVignette} aria-hidden="true" />
      <div className={styles.heroGrain} aria-hidden="true" />
    </>
  );
}

function HeroWave() {
  return (
    <svg
      className={styles.heroWave}
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true">
      <path
        d="M0,64 C240,112 480,16 720,40 C960,64 1200,112 1440,64 L1440,120 L0,120 Z"
        fill="var(--ifm-background-color)"
      />
    </svg>
  );
}

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      {/* TODO: Replace gradient hero with looping background video when assets are ready. */}
      <HeroBackdrop />
      <div className={clsx('container', styles.heroInner)}>
        <span className={styles.heroEyebrow}>
          <span className={styles.heroEyebrowDot} aria-hidden="true" />
          Awareness resource · Washington State
        </span>
        <h1 className={styles.heroTitle}>
          <span className={styles.heroTitleLine}>Backcountry</span>
          <span className={clsx(styles.heroTitleLine, styles.heroTitleAccent)}>
            Swiftwater Rescue
          </span>
        </h1>
        <p className={styles.heroSubtitle}>
          Understanding training and certification for safe backcountry river
          rescues.
        </p>
        <div className={styles.buttons}>
          <Link
            className={clsx('button button--lg', styles.btnPrimary)}
            to="/why-different">
            See the difference
          </Link>
          <Link
            className={clsx('button button--lg', styles.btnGhost)}
            to="/certification">
            Explore certification
          </Link>
        </div>
      </div>
      <HeroWave />
    </header>
  );
}

function WhoThisIsFor() {
  return (
    <section className={styles.audienceSection}>
      <div className="container">
        <div className={styles.audienceInner}>
          <span className={styles.smallEyebrow}>For</span>
          <h2>First responders, SAR teams, MRA units, and park managers.</h2>
          <p>
            Concise, practical resources covering backcountry swiftwater rescue
            training, certification pathways, and operational safety.
          </p>
        </div>
      </div>
    </section>
  );
}

function useCountUp(target, duration = 1400) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            const start = performance.now();
            const tick = (t) => {
              const p = Math.min(1, (t - start) / duration);
              const eased = 1 - Math.pow(1 - p, 3);
              setValue(Math.round(target * eased));
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      {threshold: 0.4},
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);

  return [value, ref];
}

function StatCard({value, label, accent}) {
  const [n, ref] = useCountUp(value);
  return (
    <div ref={ref} className={styles.statCard} style={{'--accent': accent}}>
      <div className={styles.statGlow} aria-hidden="true" />
      <div className={styles.statValue}>{n}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

function StatsBand() {
  const stats = [
    {value: 196, label: 'Olympic Mountain Rescue mission reports referencing rivers', accent: '#e76f51'},
    {value: 378, label: 'Whitewater sections in the American Whitewater database for Washington', accent: '#6b8ce8'},
    {value: 305, label: 'Swiftwater canyons documented in RopeWiki across Washington', accent: '#2a9d8f'},
  ];
  return (
    <section className={styles.statsSection}>
      <div className="container">
        <div className={styles.statsHeader}>
          <span className={styles.smallEyebrow}>By the numbers</span>
          <p className={styles.statsHeading}>
            Moving water is a recurring operational context in Washington — not
            a rare one.
          </p>
        </div>
        <div className={styles.statsGrid}>
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
        <p className={styles.statsFootnote}>
          Sources: Olympic Mountain Rescue audit; American Whitewater; RopeWiki.
          See <Link to="/risks">Risks &amp; Outcomes</Link>.
        </p>
      </div>
    </section>
  );
}

function WhatYouWillLearn() {
  const items = [
    'Why specialized swiftwater rescue training matters',
    'How backcountry river rescue differs from other rescue environments',
    'Common risks, operational challenges, and safety considerations',
    'Certification requirements and training pathways',
    'Recommended actions and supporting resources',
  ];
  return (
    <section className={styles.learnSection}>
      <div className="container">
        <div className={styles.learnHeader}>
          <span className={styles.smallEyebrow}>What you’ll learn</span>
          <h2>An overview, in five points.</h2>
        </div>
        <ul className={styles.learnList}>
          {items.map((t, i) => (
            <li key={t}>
              <span className={styles.learnNumber}>{String(i + 1).padStart(2, '0')}</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function KeyTakeaway() {
  return (
    <section className={styles.takeawaySection}>
      <div className="container">
        <div className={styles.takeaway}>
          <div className={styles.takeawayMeta}>
            <span className={styles.takeawayKicker}>A takeaway</span>
            <span className={styles.takeawayCount}>04</span>
          </div>
          <div className={styles.takeawayBody}>
            <p className={styles.takeawayPull}>
              <span className={styles.takeawayPullAccent}>Low-cost.</span>{' '}
              <span className={styles.takeawayPullSoft}>High-impact.</span>
            </p>
            <p className={styles.takeawayLead}>
              Consistent backcountry swiftwater training — built on awareness,
              principles, and hazard literacy — is a practical investment in
              responder and public safety.
            </p>
            <p className={styles.takeawayNote}>
              Wilderness first responders in Washington handle some of the most
              challenging backcountry water incidents. Most standard swiftwater
              training is urban-focused and does not fully prepare teams for
              remote river environments.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function NextSteps() {
  const links = [
    {to: '/recommended-actions', n: '01', label: 'Recommended actions', sub: 'What to do, by stakeholder'},
    {to: '/resources', n: '02', label: 'Resources', sub: 'References, standards, and tools'},
    {to: '/about', n: '03', label: 'About this site', sub: 'Scope, audience, and contact'},
  ];
  return (
    <section className={styles.nextSection}>
      <div className="container">
        <div className={styles.nextHead}>
          <span className={styles.smallEyebrow}>Next</span>
          <h2 className={styles.nextHeading}>Where to go from here.</h2>
        </div>
        <ul className={styles.nextList}>
          {links.map((l) => (
            <li key={l.to} className={styles.nextRow}>
              <Link to={l.to} className={styles.nextLink}>
                <span className={styles.nextNum}>{l.n}</span>
                <span className={styles.nextLabel}>{l.label}</span>
                <span className={styles.nextSub}>{l.sub}</span>
                <span className={styles.nextArrow} aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Awareness resource for backcountry swiftwater rescue training, certification, and operational safety in Washington State.">
      <HomepageHeader />
      <main>
        <WhoThisIsFor />
        <HomepageFeatures />
        <StatsBand />
        <WhatYouWillLearn />
        <KeyTakeaway />
        <NextSteps />
      </main>
    </Layout>
  );
}
