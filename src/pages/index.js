import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import FluidHero from '@site/src/components/FluidHero';

import Heading from '@theme/Heading';
import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <FluidHero>
      <header className={clsx('hero', styles.heroBanner)}>
        <div className="container">
          <Heading as="h1" className={clsx('hero__title', styles.heroTitle)}>
            {siteConfig.title}
          </Heading>
          <p className={clsx('hero__subtitle', styles.heroSubtitle)}>
            {siteConfig.tagline}
          </p>
          <div className={styles.buttons}>
            <Link
              className="button button--primary button--lg"
              to="/the-project">
              Read the Project →
            </Link>
            <Link
              className="button button--secondary button--lg"
              to="/get-involved">
              Get Involved
            </Link>
          </div>
        </div>
      </header>
    </FluidHero>
  );
}

function CallToAction() {
  return (
    <section className={styles.cta}>
      <div className="container">
        <Heading as="h2">Why This Matters</Heading>
        <p className={styles.ctaLede}>
          Washington's wilderness first responders — Mountain Rescue
          Association units and county Search and Rescue teams — answer
          the calls on backcountry rivers. The national swiftwater rescue
          curriculum they most often train on was built for urban flood
          work, not for the Class IV creeks, remote canyons, and cold,
          high-gradient rivers that define Washington's backcountry.
        </p>
        <p className={styles.ctaLede}>
          This site names that mismatch, explains why it matters, and
          makes the case for consistent backcountry swiftwater rescue
          training inside the units that already own the mission. It is
          awareness content, aimed at MRA and SAR leadership, park
          authorities, and the policy actors shaping the credential
          stack.
        </p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/the-problem">
            Start with The Problem
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="A Washington-based initiative to connect recreational river experts with Search and Rescue, and to establish a shared definition of backcountry swiftwater rescue.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <CallToAction />
      </main>
    </Layout>
  );
}
