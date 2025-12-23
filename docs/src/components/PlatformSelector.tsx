/**
 * Platform Selector Component
 * 
 * Allows users to select their deployment platform.
 */

import React from 'react';
import type { Platform } from './ConfigGenerator';

interface PlatformSelectorProps {
  selectedPlatform: Platform | null;
  onSelect: (platform: Platform) => void;
}

const platforms: Array<{
  id: Platform;
  name: string;
  description: string;
  recommended?: boolean;
}> = [
  {
    id: 'railway',
    name: 'Railway',
    description: 'One-click deployment with built-in Postgres. Best for quick setup.',
    recommended: true,
  },
  {
    id: 'render',
    name: 'Render',
    description: 'Free tier available with managed Postgres. Great for getting started.',
  },
  {
    id: 'flyio',
    name: 'Fly.io',
    description: 'Container-based deployment with Fly Postgres. Good for production.',
  },
  {
    id: 'local',
    name: 'Local',
    description: 'Deploy on your own machine with Docker Compose. Perfect for development.',
  },
];

export function PlatformSelector({ selectedPlatform, onSelect }: PlatformSelectorProps) {
  return (
    <div className="platform-selector">
      <h3>Choose Your Deployment Platform</h3>
      <p className="text--secondary">
        Select the platform where you want to deploy Danny Tasks. Railway is recommended for the easiest setup.
      </p>
      <div style={{ marginTop: '1.5rem' }}>
        {platforms.map((platform) => (
          <div
            key={platform.id}
            className={`platform-card ${selectedPlatform === platform.id ? 'selected' : ''}`}
            onClick={() => onSelect(platform.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(platform.id);
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>{platform.name}</strong>
                  {platform.recommended && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        background: 'var(--ifm-color-primary)',
                        color: 'white',
                        borderRadius: '4px',
                      }}
                    >
                      Recommended
                    </span>
                  )}
                </div>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', opacity: 0.8 }}>
                  {platform.description}
                </p>
              </div>
              {selectedPlatform === platform.id && (
                <span style={{ fontSize: '1.5rem' }}>✓</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
