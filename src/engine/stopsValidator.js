import Ajv from 'ajv';
import schema from '../data/stopsSchema.js';

const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(schema);

export class StopsValidationError extends Error {
  constructor(issues) {
    super(`stops data failed validation:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'StopsValidationError';
    this.issues = issues;
  }
}

function describeInstancePath(data, instancePath) {
  const stopMatch = instancePath.match(/^\/stops\/(\d+)(\/.*)?$/);
  if (stopMatch) {
    const [, indexStr] = stopMatch;
    const stop = data.stops?.[Number(indexStr)];
    const stopLabel = stop?.id ? `stop "${stop.id}"` : `stops[${indexStr}]`;
    return `${stopLabel} at ${instancePath}`;
  }
  return instancePath || '(root)';
}

function formatSchemaIssues(data, errors) {
  return errors.map((error) => `${describeInstancePath(data, error.instancePath)}: ${error.message}`);
}

// Cross-checks the schema can't express on its own: every flag referenced by
// an end-of-session rule must actually be produced by some stop, or the rule
// can never fire and the mistake would otherwise go unnoticed until session end.
function findUnreachableFlagIssues(data) {
  const producedFlags = new Set(data.stops.flatMap((stop) => stop.flags_on_failure ?? []));
  const issues = [];
  for (const rule of data.endOfSessionRules ?? []) {
    for (const flag of rule.requiresFlags) {
      if (!producedFlags.has(flag)) {
        issues.push(
          `endOfSessionRules "${rule.id}" requires flag "${flag}", which no stop's flags_on_failure ever sets`
        );
      }
    }
  }
  return issues;
}

// Each action's "interaction" field must name a module the registry actually
// provides; catching typos here beats discovering them mid-session.
function findUnknownInteractionIssues(data, knownInteractionNames) {
  if (!knownInteractionNames) return [];
  const issues = [];
  for (const stop of data.stops) {
    for (const [actionKey, action] of Object.entries(stop.actions)) {
      if (!knownInteractionNames.includes(action.interaction)) {
        issues.push(
          `stop "${stop.id}" action "${actionKey}" references unknown interaction "${action.interaction}"`
        );
      }
    }
  }
  return issues;
}

// Validates parsed stops data (already JSON.parse'd, not a file path) so this
// module works identically in Node and in a bundled browser build. Pass
// knownInteractionNames (the interaction registry's keys) to also catch
// typo'd interaction references; omit it to validate structure only.
export function validateStopsData(data, { knownInteractionNames } = {}) {
  const valid = validateSchema(data);
  const issues = [
    ...(valid ? [] : formatSchemaIssues(data, validateSchema.errors)),
    ...(valid ? findUnreachableFlagIssues(data) : []),
    ...(valid ? findUnknownInteractionIssues(data, knownInteractionNames) : [])
  ];

  if (issues.length > 0) {
    throw new StopsValidationError(issues);
  }

  return data;
}
