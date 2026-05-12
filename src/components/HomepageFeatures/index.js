import clsx from 'clsx';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

function ComparisonWidget() {
  return (
    <div className={styles.compare}>
      <div className={styles.compareCol}>
        <span className={styles.compareLabel}>Urban</span>
        <ul>
          <li>Minutes to patient</li>
          <li>Road access</li>
          <li>Reliable comms</li>
        </ul>
      </div>
      <div className={styles.compareCol}>
        <span className={clsx(styles.compareLabel, styles.compareLabelAccent)}>
          Backcountry
        </span>
        <ul>
          <li>Hours to patient</li>
          <li>Trail or water-only</li>
          <li>Patchy or none</li>
        </ul>
      </div>
    </div>
  );
}

function ChipsWidget() {
  const credentials = [
    'WAC 118-04',
    'NFPA 1006',
    'NFPA 1670',
    'NASAR',
    'FEMA',
    'CPR / First Aid',
    'Rope rescue',
  ];
  return (
    <div className={styles.chips}>
      {credentials.map((c) => (
        <span key={c} className={styles.chip}>{c}</span>
      ))}
    </div>
  );
}

function TierWidget() {
  const tiers = [
    {label: 'Awareness', scope: 'All members', width: 100},
    {label: 'Operations', scope: 'Edge personnel', width: 65},
    {label: 'Technician', scope: 'Water-entry team', width: 32},
  ];
  return (
    <div className={styles.tiers}>
      {tiers.map((t) => (
        <div key={t.label} className={styles.tierRow}>
          <div className={styles.tierMeta}>
            <span className={styles.tierLabel}>{t.label}</span>
            <span className={styles.tierScope}>{t.scope}</span>
          </div>
          <div className={styles.tierBar}>
            <div className={styles.tierFill} style={{width: `${t.width}%`}} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Entry({n, kicker, title, blurb, to, cta, children}) {
  return (
    <Link to={to} className={styles.entry}>
      <div className={styles.entryMeta}>
        <span className={styles.entryKicker}>{kicker}</span>
        <span className={styles.entryNumber}>{n}</span>
      </div>
      <div className={styles.entryBody}>
        <h3 className={styles.entryTitle}>{title}</h3>
        <p className={styles.entryBlurb}>{blurb}</p>
        {children}
        <span className={styles.entryCta}>
          {cta} <span className={styles.entryArrow}>→</span>
        </span>
      </div>
    </Link>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.headingWrap}>
          <span className={styles.eyebrow}>Three entry points</span>
          <h2 className={styles.sectionHeading}>Start where it makes sense.</h2>
        </div>

        <div className={styles.entries}>
          <Entry
            n="01"
            kicker="Why training matters"
            title="Urban vs. Backcountry."
            blurb="Standard swiftwater training is built for urban floods. Backcountry rivers behave nothing like that."
            to="/why-different"
            cta="See the gap">
            <ComparisonWidget />
          </Entry>

          <Entry
            n="02"
            kicker="Pathways"
            title="No single clear path."
            blurb="Multiple standards, multiple agencies, overlapping renewal cycles."
            to="/certification"
            cta="Learn more">
            <ChipsWidget />
          </Entry>

          <Entry
            n="03"
            kicker="Operational readiness"
            title="Tiered, not heroic."
            blurb="A tiered model that builds capability across a whole team — not just a few specialists."
            to="/training-gap"
            cta="See the case">
            <TierWidget />
          </Entry>
        </div>
      </div>
    </section>
  );
}
