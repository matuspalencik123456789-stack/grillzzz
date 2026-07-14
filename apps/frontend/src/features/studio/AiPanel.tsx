'use client';

import { useState } from 'react';
import type { AiDesignSuggestion } from '@grillz/shared-types';
import { Badge, Button, Input } from '@grillz/ui';
import { useAiDesigns, useAiValidation } from '@/features/api/hooks';
import { formatMoney } from '@/lib/format';
import { useStudioStore } from './store';

/**
 * AI design generation + manufacturing validation. Suggestions arrive already
 * clamped and priced by the server; applying one is a plain config load.
 */
export function AiPanel() {
  const config = useStudioStore((s) => s.config);
  const updateConfig = useStudioStore((s) => s.updateConfig);
  const [prompt, setPrompt] = useState('');
  const aiDesigns = useAiDesigns();
  const aiValidation = useAiValidation();

  const generate = () => {
    if (prompt.trim().length < 3) return;
    aiDesigns.mutate({ prompt: prompt.trim(), toothNumbers: config.toothNumbers });
  };

  const apply = (suggestion: AiDesignSuggestion) => {
    updateConfig(suggestion.config);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex gap-2">
          <Input
            placeholder='e.g. "Luxury Miami grillz"'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') generate();
            }}
          />
          <Button variant="gold" onClick={generate} disabled={aiDesigns.isPending}>
            {aiDesigns.isPending ? '…' : 'Generate'}
          </Button>
        </div>
        {aiDesigns.data && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            via {aiDesigns.data.provider === 'anthropic' ? 'Claude' : 'style engine'}
          </p>
        )}
      </div>

      {aiDesigns.data?.suggestions.map((suggestion) => (
        <button
          key={suggestion.name}
          onClick={() => apply(suggestion)}
          className="glass block w-full rounded-lg p-3 text-left transition-colors hover:border-gold-500/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{suggestion.name}</span>
            <span className="text-sm text-gold-300">
              {formatMoney(suggestion.estimatedPriceMinor)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {suggestion.rationale}
          </p>
        </button>
      ))}

      <div className="border-t border-border/60 pt-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => aiValidation.mutate(config)}
          disabled={aiValidation.isPending}
        >
          {aiValidation.isPending ? 'Checking manufacturability…' : 'Check manufacturability'}
        </Button>
        {aiValidation.data && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              {aiValidation.data.manufacturable ? (
                <Badge variant="success">manufacturable</Badge>
              ) : (
                <Badge variant="destructive">blocked</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {aiValidation.data.issues.length} finding
                {aiValidation.data.issues.length === 1 ? '' : 's'}
              </span>
            </div>
            {aiValidation.data.issues.map((issue) => (
              <div key={`${issue.code}-${issue.field ?? ''}`} className="rounded-md bg-secondary/60 p-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      issue.severity === 'BLOCKER'
                        ? 'destructive'
                        : issue.severity === 'WARNING'
                          ? 'warning'
                          : 'outline'
                    }
                  >
                    {issue.severity.toLowerCase()}
                  </Badge>
                  <span className="text-[11px] font-mono text-muted-foreground">{issue.code}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed">{issue.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
