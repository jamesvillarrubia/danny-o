import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Deployment',
      items: ['deployment/overview', 'deployment/prerequisites'],
    },
  ],
};

export default sidebars;
