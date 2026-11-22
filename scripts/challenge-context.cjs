'use strict';
// Offline adapter for the active Scenario page. All calculations stay in brief().
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const Research = require('../apps/api/research.cjs');

const seedPath = 'data/flashpoint-seed/scenario-brief.json';
const root = path.resolve(__dirname, '..');
const usage = 'Usage: node scripts/challenge-context.cjs [--baseline | --compare | --help]';

function evaluateScenario(inputs, inputSource = 'caller-provided') {
  const brief = Research.brief(inputs);
  const s = brief.scenario, f = brief.finance;
  const irrPercent = typeof f.irr === 'string' && /^-?\d+(?:\.\d+)?%$/.test(f.irr)
    ? Number(f.irr.slice(0, -1)) : null;
  return {
    schemaVersion: '1',
    source: 'carbon-twin-model',
    dataQuality: brief.quality,
    scenarioId: brief.scenarioId,
    scenarioName: brief.scenarioName,
    modelVersion: brief.modelVersion,
    inputHash: createHash('sha256').update(JSON.stringify([brief.modelVersion, brief.inputs])).digest('hex'),
    year: brief.year,
    provenance: {
      calculator: 'apps/api/research.cjs#brief',
      engineSource: 'apps/web/scenario.html (first two inline model scripts)',
      inputSource
    },
    assumptions: brief.inputs,
    units: {
      carbon: brief.units.carbon,
      money: brief.units.money,
      annualMoney: brief.units.money + '/year',
      irrPercent: 'percent (existing model display precision)',
      irrDisplay: 'existing model percent text or null',
      paybackYear: 'calendar year or null'
    },
    metrics: {
      baselineNetMtCO2PerYear: s.baselineNetMt,
      netMtCO2PerYear: s.horizonAdjustedNetMt,
      avoidedMtCO2PerYear: s.physicalAvoidedMt,
      financeAvoidedMtCO2PerYear: s.financeAvoidedMt,
      capturedMtCO2PerYear: s.capturedMt,
      grossInjectedMtCO2PerYear: s.grossInjectedMt,
      utilizedMtCO2PerYear: s.utilizedMt,
      transportLossMtCO2PerYear: s.transportLossMt,
      physicalRetainedProxyMtCO2PerYear: s.physicalRetainedProxyMt,
      permanentStoredMtCO2PerYear: s.permanentStoredMt,
      capexMillionUsd: f.grossCapexMUsd,
      netDesignCapexMillionUsd: f.netDesignCapexMUsd,
      opexMillionUsdPerYear: f.selectedYearOpexMUsd,
      npvMillionUsd: f.npvMUsd,
      irrPercent,
      irrDisplay: f.irr,
      paybackYear: f.paybackYear
    },
    limitations: [...brief.limitations,
      'This context uses the active Scenario page model. The shared /api/v1/scenarios/run model has a different carbon-chain boundary and must not be substituted without identifying its provenance.',
      'IRR percent is parsed from the existing model display and retains its rounding. Undefined or ambiguous IRR remains null; the original display is preserved.'
    ]
  };
}

function getCombined() {
  // Recalculate from saved inputs; saved metrics and survey prompts are not used.
  const saved = JSON.parse(fs.readFileSync(path.join(root, seedPath), 'utf8'));
  return evaluateScenario({ ...saved.inputs, scenarioName: saved.scenarioName }, seedPath + '#inputs');
}

function getBaseline() {
  return evaluateScenario({
    params: { ...Research.defaults.params },
    finance: { ...Research.defaults.finance },
    year: 2050,
    scenarioName: 'Baseline (current Scenario model defaults)'
  }, 'apps/api/research.cjs#defaults');
}

function compareScenarios() {
  const scenarios = [getBaseline(), getCombined()];
  return { schemaVersion: '1', source: 'carbon-twin-model', dataQuality: scenarios[0].dataQuality, scenarios };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && !['--baseline', '--compare', '--help'].includes(args[0]))) {
      throw Error(usage);
    }
    if (args[0] === '--help') console.log(usage);
    else console.log(JSON.stringify(args[0] === '--compare' ? compareScenarios()
      : args[0] === '--baseline' ? getBaseline() : getCombined(), null, 2));
  } catch (error) {
    console.error(error instanceof Research.ResearchError || error.message === usage
      ? error.message : 'Could not calculate local model context. Check the existing Scenario model and saved input file.');
    process.exitCode = 1;
  }
}

module.exports = { evaluateScenario, getBaseline, getCombined, compareScenarios };
