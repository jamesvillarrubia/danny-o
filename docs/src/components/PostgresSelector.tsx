/**
 * Postgres Selector Component
 * 
 * Allows users to choose their Postgres database option.
 */

import React from 'react';
import type { PostgresOption } from './ConfigGenerator';

interface PostgresSelectorProps {
  platform: 'railway' | 'render' | 'flyio' | 'local';
  selectedPostgres: PostgresOption | null;
  onSelect: (option: PostgresOption) => void;
  databaseUrl: string;
  onDatabaseUrlChange: (url: string) => void;
}

const postgresOptions: Array<{
  id: PostgresOption;
  name: string;
  description: string;
  availableFor: Array<'railway' | 'render' | 'flyio' | 'local'>;
}> = [
  {
    id: 'managed',
    name: 'Managed Postgres',
    description: 'Postgres database managed by your deployment platform. Easiest option.',
    availableFor: ['railway', 'render', 'flyio'],
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Serverless Postgres with generous free tier. Great for production.',
    availableFor: ['railway', 'render', 'flyio', 'local'],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Open source Firebase alternative with Postgres. Free tier available.',
    availableFor: ['railway', 'render', 'flyio', 'local'],
  },
  {
    id: 'external',
    name: 'External Postgres',
    description: 'Use your own Postgres database. Provide connection string.',
    availableFor: ['railway', 'render', 'flyio', 'local'],
  },
];

export function PostgresSelector({
  platform,
  selectedPostgres,
  onSelect,
  databaseUrl,
  onDatabaseUrlChange,
}: PostgresSelectorProps) {
  const availableOptions = postgresOptions.filter((opt) => opt.availableFor.includes(platform));

  return (
    <div className="postgres-selector">
      <h3>Choose Your Database</h3>
      <p className="text--secondary">
        Select how you want to host your PostgreSQL database. Managed Postgres is the easiest option.
      </p>
      <div style={{ marginTop: '1.5rem' }}>
        {availableOptions.map((option) => (
          <div
            key={option.id}
            className={`platform-card ${selectedPostgres === option.id ? 'selected' : ''}`}
            onClick={() => onSelect(option.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(option.id);
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{option.name}</strong>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', opacity: 0.8 }}>
                  {option.description}
                </p>
              </div>
              {selectedPostgres === option.id && (
                <span style={{ fontSize: '1.5rem' }}>✓</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {(selectedPostgres === 'external' || selectedPostgres === 'neon' || selectedPostgres === 'supabase') && (
        <div style={{ marginTop: '1.5rem' }}>
          <label htmlFor="database-url" style={{ display: 'block', marginBottom: '0.5rem' }}>
            <strong>Database Connection String</strong>
          </label>
          <input
            id="database-url"
            type="text"
            value={databaseUrl}
            onChange={(e) => onDatabaseUrlChange(e.target.value)}
            placeholder="postgresql://user:password@host:5432/dbname"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid var(--ifm-color-emphasis-300)',
              borderRadius: '4px',
              fontFamily: 'monospace',
            }}
          />
          {selectedPostgres === 'neon' && (
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.8 }}>
              Get your connection string from{' '}
              <a href="https://console.neon.tech" target="_blank" rel="noopener noreferrer">
                Neon Console
              </a>
            </p>
          )}
          {selectedPostgres === 'supabase' && (
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.8 }}>
              Get your connection string from{' '}
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
                Supabase Dashboard
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
