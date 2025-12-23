/**
 * Deployment Wizard Entry Point
 * 
 * Main page for the deployment wizard.
 */

import React from 'react';
import Layout from '@theme/Layout';
import { DeploymentWizard } from '../../components/DeploymentWizard';

export default function DeploymentPage(): JSX.Element {
  return (
    <Layout title="Deployment Wizard" description="Deploy Danny Tasks to your preferred platform">
      <div style={{ padding: '2rem 1rem', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1>Deployment Wizard</h1>
          <p className="text--secondary" style={{ fontSize: '1.1rem' }}>
            Follow the steps below to deploy Danny Tasks to Railway, Render, Fly.io, or run it locally.
          </p>
        </div>
        <DeploymentWizard />
      </div>
    </Layout>
  );
}
