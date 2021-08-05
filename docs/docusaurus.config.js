const path = require("path");

/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
  title: "Ent docs",
  url: "https://ent.dev/",
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",
  organizationName: "lolopinto", // Usually your GitHub org/user name.
  projectName: "ent", // Usually your repo name.
  plugins: [
    path.resolve(__dirname, "src/plugins/heap/index.js"),
    path.resolve(__dirname, "src/plugins/webpack/index.js"),
  ],
  themeConfig: {
    navbar: {
      title: "Home",
      logo: {
        alt: "My Site Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "doc",
          docId: "intro",
          position: "left",
          label: "Tutorial",
        },
        {
          href: "https://github.com/lolopinto/ent",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Tutorial",
              to: "/docs/intro",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Lolopinto Labs, Inc. Built with Docusaurus.`,
    },
  },
  presets: [
    [
      "@docusaurus/preset-classic",
      {
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl: "https://github.com/lolopinto/ent/edit/main/docs/",
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      },
    ],
  ],
};
