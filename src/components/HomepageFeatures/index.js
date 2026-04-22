import clsx from 'clsx';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Urban vs. Backcountry',
    Svg: require('@site/static/img/icons/urban-vs-backcountry.svg').default,
    description: (
      <>
        The national swiftwater rescue curriculum is built for urban flood
        work — storm drains, elevator rescues, submerged vehicles. That
        skillset does not transfer to a Class IV creek at mile marker twelve.
      </>
    ),
    link: '/the-problem',
    linkText: 'See the gap →',
  },
  {
    title: 'The Certification Maze',
    Svg: require('@site/static/img/icons/certification-maze.svg').default,
    description: (
      <>
        FEMA, NFPA, WAC, NASAR, rope tech, CPR, swiftwater technician —
        a stack of credentials across multiple agencies, each with its own
        renewal cycle. The complexity is part of why backcountry training
        gets under-invested.
      </>
    ),
    link: '/certification-maze',
    linkText: 'Untangle it →',
  },
  {
    title: 'The Case for Training',
    Svg: require('@site/static/img/icons/case-for-training.svg').default,
    description: (
      <>
        Consistent <em>backcountry swiftwater rescue</em> training —
        Awareness for every member, Operations for edge attendants, Technician
        for the in-water subset — is a low-cost, high-leverage investment
        for MRA and SAR units.
      </>
    ),
    link: '/the-bridge',
    linkText: 'See the case →',
  },
];

function Feature({Svg, title, description, link, linkText}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
        {link && (
          <Link to={link} className={styles.featureLink}>
            {linkText}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
