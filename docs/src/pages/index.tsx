/**
 * Landing Page
 * 
 * Main landing page with deployment CTA and project overview.
 */

import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title}`}
      description="AI-powered task management system with intelligent categorization, prioritization, and time estimation">
      <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
            {siteConfig.title}
          </h1>
          <p style={{ fontSize: '1.25rem', marginBottom: '3rem', opacity: 0.8 }}>
            {siteConfig.tagline}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '4rem' }}>
            <Link
              className="button button--primary button--lg"
              to="/deployment"
            >
              Deploy Now →
            </Link>
            <Link
              className="button button--secondary button--lg"
              to="/docs/intro"
            >
              Read Docs
            </Link>
          </div>

          <div style={{ marginTop: '4rem' }}>
            <h2 style={{ marginBottom: '2rem' }}>Features</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', textAlign: 'left' }}>
              <div>
                <h3>🤖 AI-Powered Classification</h3>
                <p>Automatically categorizes tasks using Claude AI with intelligent project and label suggestions.</p>
              </div>
              <div>
                <h3>🔄 Todoist Integration</h3>
                <p>Optional bi-directional sync with Todoist. Keep your tasks in sync across platforms.</p>
              </div>
              <div>
                <h3>⚡ Multiple Interfaces</h3>
                <p>CLI, HTTP API, and MCP server modes. Use Danny Tasks however you prefer.</p>
              </div>
              <div>
                <h3>📊 Intelligent Enrichment</h3>
                <p>AI estimates time, energy level, and supplies needed for each task.</p>
              </div>
              <div>
                <h3>🗄️ Flexible Database</h3>
                <p>SQLite for local development, PostgreSQL for production. Easy migration.</p>
              </div>
              <div>
                <h3>🚀 One-Click Deploy</h3>
                <p>Deploy to Railway, Render, or Fly.io with our interactive deployment wizard.</p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '4rem', padding: '2rem', background: 'var(--ifm-color-emphasis-100)', borderRadius: '8px' }}>
            <h2 style={{ marginBottom: '1rem' }}>Quick Start</h2>
            <p style={{ marginBottom: '2rem' }}>
              Get started with Danny Tasks in minutes using our deployment wizard.
            </p>
            <Link
              className="button button--primary button--lg"
              to="/deployment"
            >
              Launch Deployment Wizard →
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
