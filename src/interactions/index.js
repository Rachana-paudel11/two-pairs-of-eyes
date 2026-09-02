import * as cordonOff from './cordonOff.js';
import * as report from './report.js';
import * as holdPosition from './holdPosition.js';
import * as ignore from './ignore.js';
import * as continueOn from './continueOn.js';
import * as isolateAndReport from './isolateAndReport.js';

export const interactions = {
  cordonOff,
  report,
  holdPosition,
  ignore,
  continueOn,
  isolateAndReport
};

export function getInteraction(name) {
  const interaction = interactions[name];
  if (!interaction) {
    throw new Error(`Unknown interaction "${name}"`);
  }
  return interaction;
}

export const interactionNames = Object.keys(interactions);
