'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { execFileSync, spawnSync } = require('node:child_process');
const Adapter = require('../scripts/challenge-context.cjs');
const Research = require('../apps/api/research.cjs');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts/challenge-context.cjs');
const savedInputs = () => JSON.parse(fs.readFileSync(path.join(root, 'data/flashpoint-seed/scenario-brief.json'), 'utf8')).inputs;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('saved Combined inputs are recalculated through the current research brief', () => {
  const expected = Research.brief(savedInputs()), actual = Adapter.getCombined();
  assert.equal(actual.source, 'carbon-twin-model');
  assert.equal(actual.dataQuality, 'illustrative');
  assert.equal(actual.scenarioId, expected.scenarioId);
  assert.equal(actual.modelVersion, expected.modelVersion);
  assert.deepEqual(actual.assumptions, expected.inputs);
  near(actual.metrics.avoidedMtCO2PerYear, expected.scenario.physicalAvoidedMt);
  near(actual.metrics.npvMillionUsd, expected.finance.npvMUsd);
  near(actual.metrics.capexMillionUsd, expected.finance.grossCapexMUsd);
  assert.equal(actual.provenance.inputSource, 'data/flashpoint-seed/scenario-brief.json#inputs');
  assert.equal(actual.units.carbon, expected.units.carbon);
  assert.equal(actual.units.money, expected.units.money);
  assert.ok(actual.limitations.some(value => value.includes('illustrative assumptions')));
  for (const key of ['researchObjective', 'surveyQuestions', 'flashpointArguments']) assert.ok(!(key in actual));
});

test('custom inputs agree with independently loaded browser engines and preserve storage boundaries', () => {
  const inputs = savedInputs();
  inputs.finance = { ...inputs.finance, transportLoss: 8, utilShare: 40, discount: 10 };
  inputs.year = 2045;
  const html = fs.readFileSync(path.join(root, 'apps/web/scenario.html'), 'utf8');
  const browser = vm.createContext({});
  for (const match of [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].slice(0, 2)) {
    vm.runInContext(match[1], browser, { timeout: 1000 });
  }
  const physical = browser.CarbonEngine.at(inputs.params, inputs.year).r;
  const baseline = browser.CarbonEngine.calc(browser.CarbonEngine.bau(inputs.params));
  const finance = browser.FinancialEngine.finance(inputs.params, inputs.finance);
  const annual = finance.years.find(row => row.year === inputs.year);
  const actual = Adapter.evaluateScenario(inputs);
  near(actual.metrics.netMtCO2PerYear, physical.net);
  near(actual.metrics.avoidedMtCO2PerYear, baseline.net - physical.net);
  near(actual.metrics.capturedMtCO2PerYear, physical.cap);
  near(actual.metrics.physicalRetainedProxyMtCO2PerYear, physical.store);
  near(actual.metrics.grossInjectedMtCO2PerYear, annual.stored);
  near(actual.metrics.utilizedMtCO2PerYear, annual.utilized);
  near(actual.metrics.transportLossMtCO2PerYear, annual.transportLoss);
  near(actual.metrics.financeAvoidedMtCO2PerYear, annual.avoided);
  near(actual.metrics.capexMillionUsd, finance.capexGross);
  near(actual.metrics.npvMillionUsd, finance.npv);
  near(actual.metrics.opexMillionUsdPerYear, annual.opex);
  assert.equal(actual.metrics.irrDisplay, finance.irr === '—' ? null : finance.irr);
  assert.equal(actual.metrics.permanentStoredMtCO2PerYear, null);
  assert.notEqual(actual.metrics.physicalRetainedProxyMtCO2PerYear, actual.metrics.grossInjectedMtCO2PerYear);
});

test('baseline uses current defaults at 2050 and preserves undefined IRR', () => {
  const defaults = structuredClone(Research.defaults), actual = Adapter.getBaseline();
  const expected = Research.brief({ ...defaults, year: 2050 });
  assert.equal(actual.year, 2050);
  assert.equal(actual.assumptions.params.ccs, false);
  assert.deepEqual(actual.assumptions.params, defaults.params);
  near(actual.metrics.netMtCO2PerYear, expected.scenario.horizonAdjustedNetMt);
  assert.equal(actual.metrics.avoidedMtCO2PerYear, 0);
  assert.equal(actual.metrics.capturedMtCO2PerYear, 0);
  assert.equal(actual.metrics.capexMillionUsd, 0);
  assert.equal(actual.metrics.irrPercent, null);
  assert.equal(actual.metrics.irrDisplay, null);
  assert.equal(actual.metrics.paybackYear, null);
  assert.deepEqual(Research.defaults, defaults);
});

test('comparison returns separate baseline and Combined contexts with the same model provenance', () => {
  const actual = Adapter.compareScenarios();
  assert.equal(actual.scenarios.length, 2);
  assert.deepEqual(actual.scenarios, [Adapter.getBaseline(), Adapter.getCombined()]);
  const [baseline, combined] = actual.scenarios;
  assert.notEqual(baseline.scenarioId, combined.scenarioId);
  assert.equal(baseline.modelVersion, combined.modelVersion);
  assert.ok(combined.metrics.netMtCO2PerYear < baseline.metrics.netMtCO2PerYear);
  assert.equal(combined.metrics.irrPercent, Number(combined.metrics.irrDisplay.slice(0, -1)));
});

test('normalized input hashes are deterministic and a changed financial assumption changes the hash', () => {
  const inputs = savedInputs();
  Object.freeze(inputs.params); Object.freeze(inputs.finance); Object.freeze(inputs);
  const actual = Adapter.evaluateScenario(inputs);
  const reordered = Adapter.evaluateScenario({ ...inputs, params: Object.fromEntries(Object.entries(inputs.params).reverse()) });
  assert.deepEqual(actual, reordered);
  assert.match(actual.inputHash, /^[0-9a-f]{64}$/);
  const changed = Adapter.evaluateScenario({ ...inputs, params: { ...inputs.params, cp: inputs.params.cp + 10 } });
  assert.notEqual(actual.inputHash, changed.inputHash);
  assert.notEqual(actual.scenarioId, changed.scenarioId);
  assert.notEqual(actual.metrics.npvMillionUsd, changed.metrics.npvMillionUsd);
  assert.equal(actual.metrics.capturedMtCO2PerYear, changed.metrics.capturedMtCO2PerYear);
});

test('existing model validation rejects invalid inputs before producing context', () => {
  const inputs = savedInputs();
  for (const invalid of [
    { ...inputs, year: 2051 },
    { ...inputs, params: { ...inputs.params, cap: 101 } },
    { ...inputs, params: { ...inputs.params, re: 0 } },
    { ...inputs, finance: { ...inputs.finance, discount: -1 } }
  ]) assert.throws(() => Adapter.evaluateScenario(invalid), Research.ResearchError);
});

test('CLI returns JSON for all modes from a different working directory without credentials', () => {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(OPENAI_|ANTHROPIC_|FLASHPOINT_)/i.test(key)) delete env[key];
  }
  for (const [args, expected] of [[[], Adapter.getCombined()], [['--baseline'], Adapter.getBaseline()], [['--compare'], Adapter.compareScenarios()]]) {
    const output = execFileSync(process.execPath, [script, ...args], { cwd: os.tmpdir(), env, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(output), expected);
  }
});

test('unsupported CLI arguments exit without a JSON result', () => {
  for (const args of [['--publish'], ['--baseline', '--compare']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Usage:/);
  }
});

test('local HTTP brief matches the adapter and shared scenario APIs retain their own model', async () => {
  const { app } = require('../apps/api/server.cjs');
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + app.address().port;
  const post = (route, body) => fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  try {
    const health = await fetch(base + '/api/v1/health');
    assert.equal(health.status, 200);
    const inputs = savedInputs(), context = Adapter.evaluateScenario(inputs);
    const response = await post('/api/v1/research/brief', inputs);
    assert.equal(response.status, 200);
    const brief = await response.json();
    assert.equal(context.scenarioId, brief.scenarioId);
    assert.equal(context.modelVersion, brief.modelVersion);
    assert.equal(context.metrics.npvMillionUsd, brief.finance.npvMUsd);
    assert.equal(context.metrics.capturedMtCO2PerYear, brief.scenario.capturedMt);
    const scenarios = [Adapter.getBaseline(), context].map(c => ({ year: c.year, legacyParams: c.assumptions.params }));
    const compared = await post('/api/v1/scenarios/compare', { schemaVersion: '1', finance: inputs.finance, scenarios });
    assert.equal(compared.status, 200);
    const shared = await compared.json();
    assert.equal(shared.scenarios.length, 2);
    assert.ok(shared.scenarios[1].netMt < shared.scenarios[0].netMt);
    assert.notEqual(shared.modelVersion, context.modelVersion);
    const run = await post('/api/v1/scenarios/run', { schemaVersion: '1', finance: inputs.finance, scenario: scenarios[1] });
    assert.equal(run.status, 200);
    assert.deepEqual((await run.json()).metrics, shared.scenarios[1]);
  } finally {
    await new Promise(resolve => app.close(resolve));
  }
});
