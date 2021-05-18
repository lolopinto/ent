
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
  component: ComponentCreator('/docs','2d7'),
  
  routes: [
{
  path: '/docs/hello',
  component: ComponentCreator('/docs/hello','bc1'),
  exact: true,
},
{
  path: '/docs/intro',
  component: ComponentCreator('/docs/intro','e84'),
  exact: true,
},
{
  path: '/docs/tutorial-basics/congratulations',
  component: ComponentCreator('/docs/tutorial-basics/congratulations','7ef'),
  exact: true,
},
{
  path: '/docs/tutorial-basics/create-a-blog-post',
  component: ComponentCreator('/docs/tutorial-basics/create-a-blog-post','2c8'),
  exact: true,
},
{
  path: '/docs/tutorial-basics/create-a-document',
  component: ComponentCreator('/docs/tutorial-basics/create-a-document','f0d'),
  exact: true,
},
{
  path: '/docs/tutorial-basics/create-a-page',
  component: ComponentCreator('/docs/tutorial-basics/create-a-page','ca5'),
  exact: true,
},
{
  path: '/docs/tutorial-basics/deploy-your-site',
  component: ComponentCreator('/docs/tutorial-basics/deploy-your-site','508'),
  exact: true,
},
{
  path: '/docs/tutorial-basics/markdown-features',
  component: ComponentCreator('/docs/tutorial-basics/markdown-features','f90'),
  exact: true,
},
{
  path: '/docs/tutorial-extras/manage-docs-versions',
  component: ComponentCreator('/docs/tutorial-extras/manage-docs-versions','d64'),
  exact: true,
},
{
  path: '/docs/tutorial-extras/translate-your-site',
  component: ComponentCreator('/docs/tutorial-extras/translate-your-site','16a'),
  exact: true,
},
]
},
{
  path: '*',
  component: ComponentCreator('*')
}
];
