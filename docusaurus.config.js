// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Backcountry Swiftwater Rescue',
  tagline: 'Why Washington\'s wilderness first responders need backcountry swiftwater rescue training',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://mariagilca.github.io',
  baseUrl: '/swr/',

  organizationName: 'mariagilca',
  projectName: 'swr',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'warn',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        // Docs and blog are disabled — the site is pages-only.
        docs: false,
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/docusaurus-social-card.jpg',
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Backcountry Swiftwater Rescue',
        logo: {
          alt: 'Backcountry Swiftwater Rescue',
          src: 'img/logo.svg',
        },
        items: [
          {to: '/the-project', label: 'The Project', position: 'left'},
          {to: '/the-problem', label: 'The Problem', position: 'left'},
          {to: '/river-safety', label: 'River Safety', position: 'left'},
          {to: '/resources', label: 'Resources', position: 'left'},
          {to: '/get-involved', label: 'Get Involved', position: 'left'},
          {
            href: 'https://mra.org/all-teams/washington-region/',
            label: 'WMRA',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'The Project',
            items: [
              {label: 'Overview', to: '/the-project'},
              {label: 'The Problem', to: '/the-problem'},
              {label: 'What Is Backcountry Swiftwater Rescue?', to: '/what-is-swiftwater-rescue'},
              {label: 'The Certification Maze', to: '/certification-maze'},
              {label: 'The Gap', to: '/the-gap'},
              {label: 'The Bridge', to: '/the-bridge'},
            ],
          },
          {
            title: 'Field',
            items: [
              {label: 'River Safety', to: '/river-safety'},
              {label: 'Resources', to: '/resources'},
              {label: 'Get Involved', to: '/get-involved'},
            ],
          },
          {
            title: 'Partners',
            items: [
              {
                label: 'Washington Mountain Rescue Association',
                href: 'https://mra.org/all-teams/washington-region/',
              },
              {
                label: 'Mountain Rescue Association',
                href: 'https://mra.org',
              },
            ],
          },
          {
            title: 'Media',
            items: [
              {label: 'Photo & Video Album', href: 'https://photos.google.com/share/AF1QipNN_XvfCteMY-io9RLmyqluRfp_sYHqBdJLDXkdAAxh6UqS4anZOoEdsIPzXsNytQ?key=TFhHV2ctYW5NTjlmTHY1ZXVvWVVDWTB6NWstXzln'},
              {label: 'MRA "Who We Are" Video', href: 'https://www.youtube.com/watch?v=v1sSkkmCW6E'},
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Backcountry Swiftwater Rescue Project. In collaboration with WMRA.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
