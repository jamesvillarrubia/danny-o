/**
 * Deployment Wizard Component
 * 
 * Multi-step wizard for deploying Danny Tasks to various platforms.
 */

import React, { useState } from 'react';
import { PlatformSelector } from './PlatformSelector';
import { PostgresSelector } from './PostgresSelector';
import {
  type Platform,
  type PostgresOption,
  type DeploymentConfig,
  generateRailwayConfig,
  generateRenderConfig,
  generateFlyToml,
  generateEnvExample,
  generateDockerCompose,
  downloadFile,
} from './ConfigGenerator';

type WizardStep = 'platform' | 'postgres' | 'env' | 'config' | 'instructions';

export function DeploymentWizard() {
  const [step, setStep] = useState<WizardStep>('platform');
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [postgres, setPostgres] = useState<PostgresOption | null>(null);
  const [databaseUrl, setDatabaseUrl] = useState('');
  const [todoistApiKey, setTodoistApiKey] = useState('');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [appName, setAppName] = useState('danny-tasks-api');

  const config: DeploymentConfig = {
    platform: platform!,
    postgres: postgres!,
    appName,
    todoistApiKey,
    claudeApiKey,
    databaseUrl: databaseUrl || undefined,
  };

  const handleNext = () => {
    if (step === 'platform' && platform) {
      // Skip postgres step for local deployment
      if (platform === 'local') {
        setPostgres('external');
        setStep('env');
      } else {
        setStep('postgres');
      }
    } else if (step === 'postgres' && postgres) {
      setStep('env');
    } else if (step === 'env') {
      setStep('config');
    } else if (step === 'config') {
      setStep('instructions');
    }
  };

  const handleBack = () => {
    if (step === 'postgres') {
      setStep('platform');
    } else if (step === 'env') {
      if (platform === 'local') {
        setStep('platform');
      } else {
        setStep('postgres');
      }
    } else if (step === 'config') {
      setStep('env');
    } else if (step === 'instructions') {
      setStep('config');
    }
  };

  const handleDownloadConfig = () => {
    if (!platform) return;

    let content = '';
    let filename = '';
    let mimeType = 'text/plain';

    switch (platform) {
      case 'railway':
        content = generateRailwayConfig(config);
        filename = 'railway.json';
        mimeType = 'application/json';
        break;
      case 'render':
        content = generateRenderConfig(config);
        filename = 'render.yaml';
        mimeType = 'text/yaml';
        break;
      case 'flyio':
        content = generateFlyToml(config);
        filename = 'fly.toml';
        break;
      case 'local':
        content = generateDockerCompose(config);
        filename = 'docker-compose.yml';
        break;
    }

    downloadFile(filename, content, mimeType);
  };

  const handleDownloadEnv = () => {
    const content = generateEnvExample(config);
    downloadFile('.env.example', content);
  };

  const getConfigPreview = () => {
    if (!platform) return '';

    switch (platform) {
      case 'railway':
        return generateRailwayConfig(config);
      case 'render':
        return generateRenderConfig(config);
      case 'flyio':
        return generateFlyToml(config);
      case 'local':
        return generateDockerCompose(config);
      default:
        return '';
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'platform':
        return platform !== null;
      case 'postgres':
        return postgres !== null && (postgres === 'managed' || databaseUrl.trim() !== '');
      case 'env':
        return todoistApiKey.trim() !== '' && claudeApiKey.trim() !== '';
      default:
        return true;
    }
  };

  return (
    <div className="deployment-wizard">
      <div className="wizard-step">
        {/* Progress Indicator */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {(['platform', 'postgres', 'env', 'config', 'instructions'] as WizardStep[]).map((s, i) => {
              const isActive = s === step;
              const isCompleted = ['platform', 'postgres', 'env', 'config', 'instructions'].indexOf(step) > i;
              return (
                <div
                  key={s}
                  style={{
                    flex: 1,
                    height: '4px',
                    background: isActive || isCompleted ? 'var(--ifm-color-primary)' : 'var(--ifm-color-emphasis-200)',
                    borderRadius: '2px',
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', opacity: 0.7 }}>
            <span>Platform</span>
            <span>Database</span>
            <span>API Keys</span>
            <span>Config</span>
            <span>Deploy</span>
          </div>
        </div>

        {/* Step Content */}
        {step === 'platform' && (
          <PlatformSelector
            selectedPlatform={platform}
            onSelect={setPlatform}
          />
        )}

        {step === 'postgres' && platform && (
          <PostgresSelector
            platform={platform}
            selectedPostgres={postgres}
            onSelect={setPostgres}
            databaseUrl={databaseUrl}
            onDatabaseUrlChange={setDatabaseUrl}
          />
        )}

        {step === 'env' && (
          <div>
            <h3>API Keys</h3>
            <p className="text--secondary">
              Enter your API keys. These will be used to configure your deployment.
            </p>
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label htmlFor="todoist-key" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  <strong>Todoist API Key</strong>
                </label>
                <input
                  id="todoist-key"
                  type="password"
                  value={todoistApiKey}
                  onChange={(e) => setTodoistApiKey(e.target.value)}
                  placeholder="Enter your Todoist API key"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--ifm-color-emphasis-300)',
                    borderRadius: '4px',
                  }}
                />
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.8 }}>
                  Get your API key from{' '}
                  <a href="https://todoist.com/prefs/integrations" target="_blank" rel="noopener noreferrer">
                    Todoist Settings
                  </a>
                </p>
              </div>
              <div>
                <label htmlFor="claude-key" style={{ display: 'block', marginBottom: '0.5rem' }}>
                  <strong>Claude API Key</strong>
                </label>
                <input
                  id="claude-key"
                  type="password"
                  value={claudeApiKey}
                  onChange={(e) => setClaudeApiKey(e.target.value)}
                  placeholder="Enter your Claude API key"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--ifm-color-emphasis-300)',
                    borderRadius: '4px',
                  }}
                />
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.8 }}>
                  Get your API key from{' '}
                  <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">
                    Anthropic Console
                  </a>
                </p>
              </div>
              {platform === 'flyio' && (
                <div>
                  <label htmlFor="app-name" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    <strong>Fly.io App Name</strong>
                  </label>
                  <input
                    id="app-name"
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="danny-tasks-api"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--ifm-color-emphasis-300)',
                      borderRadius: '4px',
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'config' && (
          <div>
            <h3>Configuration Files</h3>
            <p className="text--secondary">
              Review and download your configuration files. Add these to your repository.
            </p>
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong>Platform Configuration</strong>
                  <button
                    className="button button--primary button--sm"
                    onClick={handleDownloadConfig}
                  >
                    Download
                  </button>
                </div>
                <div className="config-preview">
                  <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                    <code>{getConfigPreview()}</code>
                  </pre>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong>Environment Variables</strong>
                  <button
                    className="button button--secondary button--sm"
                    onClick={handleDownloadEnv}
                  >
                    Download .env.example
                  </button>
                </div>
                <div className="config-preview">
                  <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                    <code>{generateEnvExample(config)}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'instructions' && (
          <div>
            <h3>Deployment Instructions</h3>
            <p className="text--secondary">
              Follow these steps to complete your deployment.
            </p>
            <div style={{ marginTop: '1.5rem' }}>
              {platform === 'railway' && (
                <div>
                  <h4>Railway Deployment Steps</h4>
                  <ol>
                    <li>Sign up for <a href="https://railway.app" target="_blank" rel="noopener noreferrer">Railway</a></li>
                    <li>Create a new project and connect your GitHub repository</li>
                    <li>Add the <code>railway.json</code> file to your repository root</li>
                    <li>Add a PostgreSQL service (or use external database)</li>
                    <li>Add environment variables in Railway dashboard:
                      <ul>
                        <li><code>TODOIST_API_KEY</code></li>
                        <li><code>CLAUDE_API_KEY</code></li>
                        {postgres === 'managed' && (
                          <li><code>DATABASE_URL</code> (auto-set by Railway)</li>
                        )}
                        {postgres !== 'managed' && (
                          <li><code>DATABASE_URL</code> (your connection string)</li>
                        )}
                      </ul>
                    </li>
                    <li>Deploy your API service</li>
                    <li>Deploy frontend to Vercel or Railway</li>
                  </ol>
                </div>
              )}
              {platform === 'render' && (
                <div>
                  <h4>Render Deployment Steps</h4>
                  <ol>
                    <li>Sign up for <a href="https://render.com" target="_blank" rel="noopener noreferrer">Render</a></li>
                    <li>Create a new Blueprint from your repository</li>
                    <li>Add the <code>render.yaml</code> file to your repository root</li>
                    <li>Render will detect the Blueprint and create services</li>
                    <li>Set environment variables in Render dashboard:
                      <ul>
                        <li><code>TODOIST_API_KEY</code></li>
                        <li><code>CLAUDE_API_KEY</code></li>
                        {postgres === 'managed' && (
                          <li><code>DATABASE_URL</code> (auto-set by Render)</li>
                        )}
                        {postgres !== 'managed' && (
                          <li><code>DATABASE_URL</code> (your connection string)</li>
                        )}
                      </ul>
                    </li>
                    <li>Deploy your services</li>
                    <li>Deploy frontend to Vercel or Render</li>
                  </ol>
                </div>
              )}
              {platform === 'flyio' && (
                <div>
                  <h4>Fly.io Deployment Steps</h4>
                  <ol>
                    <li>Install Fly CLI: <code>curl -L https://fly.io/install.sh | sh</code></li>
                    <li>Sign up: <code>fly auth signup</code></li>
                    <li>Navigate to <code>api/</code> directory</li>
                    <li>Copy <code>fly.toml</code> to <code>api/</code> directory</li>
                    <li>Run <code>fly launch</code> (or <code>fly apps create {appName}</code>)</li>
                    <li>Create Postgres database: <code>fly postgres create</code></li>
                    <li>Attach database: <code>fly postgres attach [db-name] --app {appName}</code></li>
                    <li>Set secrets:
                      <ul>
                        <li><code>fly secrets set TODOIST_API_KEY="..."</code></li>
                        <li><code>fly secrets set CLAUDE_API_KEY="..."</code></li>
                        {postgres !== 'managed' && (
                          <li><code>fly secrets set DATABASE_URL="..."</code></li>
                        )}
                      </ul>
                    </li>
                    <li>Deploy: <code>fly deploy</code></li>
                    <li>Deploy frontend to Vercel</li>
                  </ol>
                </div>
              )}
              {platform === 'local' && (
                <div>
                  <h4>Local Deployment Steps</h4>
                  <ol>
                    <li>Ensure Docker and Docker Compose are installed</li>
                    <li>Copy <code>docker-compose.yml</code> to repository root</li>
                    <li>Create <code>.env</code> file with your environment variables</li>
                    <li>Run <code>docker-compose up -d</code></li>
                    <li>API will be available at <code>http://localhost:8080</code></li>
                    <li>Web will be available at <code>http://localhost:3000</code></li>
                    <li>For development, run <code>pnpm dev</code> from root</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="wizard-navigation">
          <button
            className="button button--secondary"
            onClick={handleBack}
            disabled={step === 'platform'}
          >
            Back
          </button>
          {step !== 'instructions' ? (
            <button
              className="button button--primary"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Next
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <a
                href={`/deployment/${platform}`}
                className="button button--primary"
              >
                View Detailed Guide
              </a>
              <button
                className="button button--secondary"
                onClick={() => {
                  setStep('platform');
                  setPlatform(null);
                  setPostgres(null);
                  setDatabaseUrl('');
                  setTodoistApiKey('');
                  setClaudeApiKey('');
                }}
              >
                Start Over
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
