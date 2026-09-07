import fs from 'node:fs';
import path from 'node:path';
import { promoteSuggestion, persistIdeaSuggestion, loadIdeaSuggestions, SCOPE_CLASSIFICATIONS } from './idea-suggestions.mjs';
import { reconcileCanonicalArtifact, fingerprintCanonicalArtifact } from './reconciliation.mjs';

export class PromotionError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'PromotionError';
    this.details = details;
  }
}

export function promoteSuggestionToArtifact({
  suggestion,
  action, // 'ACCEPT' | 'DEFER' | 'REJECT'
  targetScope = null,
  decisionId,
  decisionAuthority = 'Product Owner',
  reason = null,
  selectedOption = null,
  rootDir = process.cwd(),
  artifactPath = null, // e.g. 'docs/01-concept/idea-brief.md' or null
} = {}) {
  const updatedSuggestion = promoteSuggestion({
    suggestion,
    action,
    targetScope,
    decisionId,
    decisionAuthority,
    reason,
    selectedOption,
  });

  // Persist suggestion record
  persistIdeaSuggestion(updatedSuggestion, rootDir);

  // If accepted or deferred, update canonical artifact if specified or found
  if (artifactPath) {
    const fullPath = path.resolve(rootDir, artifactPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const expectedFingerprint = fingerprintCanonicalArtifact(rootDir, artifactPath);

      if (action === 'ACCEPT') {
        const scope = updatedSuggestion.promotedScope;
        let targetHeading = '## Requirements (Must)';
        if (scope === SCOPE_CLASSIFICATIONS.SHOULD_HAVE) {
          targetHeading = '## Preferences (Should)';
        } else if (scope === SCOPE_CLASSIFICATIONS.COULD_HAVE) {
          targetHeading = '## Could Have';
        }

        const tag = `[${updatedSuggestion.id}]`;
        if (!content.includes(tag)) {
          // Add requirement under the heading
          if (content.includes(targetHeading)) {
            const replacement = `${targetHeading}\n\n- ${updatedSuggestion.title} ${tag}`;
            reconcileCanonicalArtifact({
              rootDir,
              path: artifactPath,
              expectedFingerprint,
              operations: [
                {
                  type: 'replace',
                  find: targetHeading,
                  replace: replacement,
                  expectedMatches: 1,
                },
              ],
              amendmentId: `AMEND-${updatedSuggestion.id}-${Date.now()}`,
            });
          }
        }
      } else if (action === 'DEFER') {
        const tag = `[${updatedSuggestion.id}]`;
        const targetHeading = '## Future Ideas (Explicitly Deferred)';
        if (content.includes(targetHeading) && !content.includes(tag)) {
          const replacement = `${targetHeading}\n\n- ${updatedSuggestion.title} ${tag}`;
          reconcileCanonicalArtifact({
            rootDir,
            path: artifactPath,
            expectedFingerprint,
            operations: [
              {
                type: 'replace',
                find: targetHeading,
                replace: replacement,
                expectedMatches: 1,
              },
            ],
            amendmentId: `AMEND-${updatedSuggestion.id}-DEFER-${Date.now()}`,
          });
        }
      }
    }
  }

  return updatedSuggestion;
}

export function routeAcceptedSuggestion({
  suggestion,
  isExistingProject = false,
  affectedArtifacts = [],
  rootDir = process.cwd(),
}) {
  if (isExistingProject) {
    return {
      route: 'EXISTING_PROJECT_DELTA',
      requiresImpactAnalysis: true,
      affectedArtifacts,
      actionRequired: 'AMEND_AFFECTED_ARTIFACTS_ONLY',
      restartRequired: false,
    };
  }

  return {
    route: 'NEW_PROJECT_FORWARD',
    requiresImpactAnalysis: false,
    nextStage: 'DEFINE',
    command: '/dk-spec',
    actionRequired: 'PROCEED_TO_SPEC',
  };
}
