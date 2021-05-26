import React from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';

const FeatureList = [
  {
    title: 'Easy to Use',
    Svg: require('../../static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Ent was designed to be easy to use and to enable you to focus on
        what's different about your application.
      </>
    ),
  },
  {
    title: "Focus on What's Different",
    Svg: require('../../static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        The Ent Framework lets you focus on what's different about your application. You provide a
        schema and take it from there: code is generated to handle database, middle layer and GraphQL.
      </>
    ),
  },
  {
    title: 'Completely Customizable',
    Svg: require('../../static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Extend and customize the framework as needed. Can customize every layer of the stack.
      </>
    ),
  },
];

function Feature({ Svg, title, description }) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} alt={title} />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
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
