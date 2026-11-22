'use strict';
const { createHash } = require('node:crypto');

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function id(value, label = 'identifier') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value) || /^0x[0-9a-f]{64}$/i.test(value)) {
    fail('INVALID_IDENTIFIER', 'Invalid ' + label);
  }
  return value;
}
function text(value, label = 'text', max = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail('INVALID_INPUT', 'Invalid ' + label);
  return value.trim();
}
function redactText(value) {
  return String(value)
    .replace(/-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/g, '[REDACTED_KEY]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_TOKEN]')
    .replace(/\b(?:0x)?[0-9a-fA-F]{64}\b/g, '[REDACTED_HEX]')
    .replace(/\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/https?:\/\/[^\s<>]+/gi, '[REDACTED_URL]')
    .replace(/\b(?:seed\s*phrase|mnemonic)\s*[:=][^\r\n]+/gi, '[REDACTED_SEED]')
    .replace(/\b(?:private[_ -]?key|api[_ -]?key|password|token|signature)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '[REDACTED_CREDENTIAL]')
    .replace(/(?<!\w)\+?\d[\d ()-]{7,}\d(?!\w)/g, '[REDACTED_PHONE]');
}
function redact(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redact);
  if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    /^(?:authorization|cookie|.*token|.*secret|private_?key|signature|seed_?phrase|mnemonic|emails?|recipients?|respondent.*|response_?id|contact.*|name)$/i.test(key)
      ? '[REDACTED]' : redact(item)]));
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function reference(value) {
  const result = text(value, 'evidence reference', 300);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_./:#-]*$/.test(result) || result.includes('..') || result.includes('://')) {
    fail('INVALID_INPUT', 'Use a local evidence reference without URLs or identities');
  }
  if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|0x[0-9a-f]{64}/i.test(result)) {
    fail('INVALID_INPUT', 'Credential-like evidence references are forbidden');
  }
  return result;
}
module.exports = { fail, object, id, text, redactText, redact, digest, reference };
