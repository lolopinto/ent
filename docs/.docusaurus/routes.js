
import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';
export default [
{
  path: '/',
  component: ComponentCreator('/','deb'),
  exact: true,
},
{
  path: '/__docusaurus/debug',
  component: ComponentCreator('/__docusaurus/debug','3d6'),
  exact: true,
},
{
  path: '/__docusaurus/debug/config',
  component: ComponentCreator('/__docusaurus/debug/config','914'),
  exact: true,
},
{
  path: '/__docusaurus/debug/content',
  component: ComponentCreator('/__docusaurus/debug/content','c28'),
  exact: true,
},
{
  path: '/__docusaurus/debug/globalData',
  component: ComponentCreator('/__docusaurus/debug/globalData','3cf'),
  exact: true,
},
{
  path: '/__docusaurus/debug/metadata',
  component: ComponentCreator('/__docusaurus/debug/metadata','31b'),
  exact: true,
},
{
  path: '/__docusaurus/debug/registry',
  component: ComponentCreator('/__docusaurus/debug/registry','0da'),
  exact: true,
},
{
  path: '/__docusaurus/debug/routes',
  component: ComponentCreator('/__docusaurus/debug/routes','244'),
  exact: true,
},
{
  path: '/markdown-page',
  component: ComponentCreator('/markdown-page','be1'),
  exact: true,
},
{
  path: '/docs',
  component: ComponentCreator('/docs','f7e'),
  
  routes: [
{
  path: '/docs/core-concepts/auth',
  component: ComponentCreator('/docs/core-concepts/auth','847'),
  exact: true,
},
{
  path: '/docs/core-concepts/context',
  component: ComponentCreator('/docs/core-concepts/context','45b'),
  exact: true,
},
{
  path: '/docs/core-concepts/context-caching',
  component: ComponentCreator('/docs/core-concepts/context-caching','650'),
  exact: true,
},
{
  path: '/docs/core-concepts/ent',
  component: ComponentCreator('/docs/core-concepts/ent','448'),
  exact: true,
},
{
  path: '/docs/core-concepts/ent-query',
  component: ComponentCreator('/docs/core-concepts/ent-query','cfd'),
  exact: true,
},
{
  path: '/docs/core-concepts/privacy-policy',
  component: ComponentCreator('/docs/core-concepts/privacy-policy','23c'),
  exact: true,
},
{
  path: '/docs/core-concepts/viewer',
  component: ComponentCreator('/docs/core-concepts/viewer','4a7'),
  exact: true,
},
{
  path: '/docs/ent-schema/actions',
  component: ComponentCreator('/docs/ent-schema/actions','428'),
  exact: true,
},
{
  path: '/docs/ent-schema/constraints',
  component: ComponentCreator('/docs/ent-schema/constraints','00d'),
  exact: true,
},
{
  path: '/docs/ent-schema/edge-groups',
  component: ComponentCreator('/docs/ent-schema/edge-groups','ac6'),
  exact: true,
},
{
  path: '/docs/ent-schema/edges',
  component: ComponentCreator('/docs/ent-schema/edges','8fd'),
  exact: true,
},
{
  path: '/docs/ent-schema/enums',
  component: ComponentCreator('/docs/ent-schema/enums','aa1'),
  exact: true,
},
{
  path: '/docs/ent-schema/fields',
  component: ComponentCreator('/docs/ent-schema/fields','b6e'),
  exact: true,
},
{
  path: '/docs/ent-schema/indices',
  component: ComponentCreator('/docs/ent-schema/indices','675'),
  exact: true,
},
{
  path: '/docs/ent-schema/patterns',
  component: ComponentCreator('/docs/ent-schema/patterns','40e'),
  exact: true,
},
{
  path: '/docs/ent-schema/schema',
  component: ComponentCreator('/docs/ent-schema/schema','465'),
  exact: true,
},
{
  path: '/docs/intro',
  component: ComponentCreator('/docs/intro','e84'),
  exact: true,
},
]
},
{
  path: '*',
  component: ComponentCreator('*')
}
];
