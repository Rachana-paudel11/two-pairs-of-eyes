/**
 * ScenarioService.js
 * Decoupled scenario data service for Two Pairs of Eyes simulation.
 * 
 * Provides validated scenario data from the backend repository when online,
 * with seamless zero-latency fallback to the compiled dataset in offline / static mode.
 */

import defaultStopsData from '../data/stopsData.js';
import { validateStopsData } from '../engine/stopsValidator.js';
import { interactionNames } from '../interactions/index.js';

const SCENARIOS_API_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api/scenarios'
  : '/api/scenarios';

export class ScenarioService {
  /**
   * Returns default scenarios bundle immediately.
   */
  static getDefaultScenarios() {
    return defaultStopsData;
  }

  /**
   * Asynchronously loads scenarios from the backend repository.
   * Validates via AJV stops validator before returning.
   */
  static async loadScenarios() {
    if (typeof fetch === 'undefined') {
      return defaultStopsData;
    }

    try {
      const response = await fetch(SCENARIOS_API_URL);
      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data && Array.isArray(json.data.stops) && json.data.stops.length > 0) {
          const validated = validateStopsData(json.data, { knownInteractionNames: interactionNames });
          console.log(`[ScenarioService] Synchronized ${validated.stops.length} scenarios from backend repository.`);
          return validated;
        }
      }
    } catch {
      // Backend offline or running in standalone static environment
      console.info('[ScenarioService] Operating in resilient offline mode using bundled scenario dataset.');
    }

    return defaultStopsData;
  }
}
