// @ts-check
// Docusaurus config for the Backcountry Swiftwater Rescue awareness site.

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Backcountry Swiftwater Rescue',
  tagline: 'Training and certification for safe backcountry river rescues',
  favicon: 'img/favicon.svg',

  url: 'https://mariagilca.github.io',
  baseUrl: '/swr/',
  organizationName: 'mariagilca',
  projectName: 'swr',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: false,
        blog: false,
        pages: {
          path: 'src/pages',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/swr-social-card.svg',
      colorMode: {
        defaultMode: 'light',
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Backcountry SWR',
        hideOnScroll: true,
        logo: {
          alt: 'Chelan County Sheriff Search and Rescue badge',
          src: 'img/logo-chelan-sar.svg',
        },
        items: [
          {to: '/why-different', label: 'Why It’s Different', position: 'left'},
          {to: '/certification', label: 'Certification', position: 'left'},
          {to: '/training-gap', label: 'Training Gap', position: 'left'},
          {
            type: 'dropdown',
            label: 'More',
            position: 'left',
            items: [
              {to: '/risks', label: 'Risks & Outcomes'},
              {to: '/recommended-actions', label: 'Recommended Actions'},
              {to: '/resources', label: 'Resources'},
            ],
          },
          {to: '/about', label: 'About', position: 'right'},
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Site',
            items: [
              {label: 'Home', to: '/'},
              {label: 'About This Site', to: '/about'},
              {label: 'Why Swiftwater Rescue Is Different', to: '/why-different'},
              {label: 'Certification Requirements', to: '/certification'},
            ],
          },
          {
            title: 'More',
            items: [
              {label: 'The Training Gap', to: '/training-gap'},
              {label: 'Risks, Impacts, and Safety Outcomes', to: '/risks'},
              {label: 'Recommended Actions', to: '/recommended-actions'},
              {label: 'Resources', to: '/resources'},
            ],
          },
          {
            title: 'References',
            items: [
              {
                label: 'Washington Mountain Rescue Association',
                href: 'https://www.wmra.org/',
              },
              {
                label: 'American Whitewater accident database',
                href: 'https://www.americanwhitewater.org/content/Accident/view/',
              },
              {
                label: 'NOAA river predictions',
                href: 'https://water.noaa.gov/',
              },
            ],
          },
        ],
        copyright: `Built by Team ReelCraft for PTW 330 (${new Date().getFullYear()}). Awareness-level reference only — not a substitute for certified swiftwater training.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
