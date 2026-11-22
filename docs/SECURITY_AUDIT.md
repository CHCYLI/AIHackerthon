# Submission security audit

Date: November22, 2026. Scope: public working files, full Git index/staged changes,
and the complete ancestry of the prepared submission branch. The correct target
was verified as the public `CHCYLI/CarbonX-Final-Project` repository, default main.

## Checks and findings

- Searched textual content and relevant historical blobs/commit objects for common
  API/GitHub/AWS tokens, PEM private keys, JWTs, literal bearer credentials, wallet
  key assignments, credential-bearing URLs and private runtime/credential paths.
- Checked exact known private recipient, response ID, raw answer strings and
  device metadata against public candidates, index and publication history.
  Reports contain rule/path metadata only, never the matched private values.
- Private `.runtime`, contacts, original receipts/answers and credentials are
  excluded from Git. Offline fixtures are artificial and explicitly labelled.
- Initial working files and index had no credential/private-data findings. Six
  historical commits contained the private recipient address in identity
  metadata. The prepared public history substitutes the owner's GitHub noreply
  identity while preserving all seven historical file trees byte-for-byte.
  Parent hashes necessarily change. One old signature was removed because a
  rewritten commit cannot retain that signature's validity.
- The original local main is retained for recovery; it is not the cleaned
  submission branch. Remote replacement uses an explicit expected-head lease
  rather than an unconditional overwrite. Previously public clones/caches may
  retain old metadata; this procedure cannot revoke already disclosed information.
- The final submission uses a noreply commit identity. No OAuth credential store
  or wallet secret was accessed and no live payment/signing test was performed.

## Limits

This is a signature/literal and known-private-data audit, not a guarantee against
every possible encoded secret or software vulnerability. Large/binary media
content is not exhaustively scanned, although paths/history are enumerated.
Checks do not establish provider authenticity or erase third-party Git caches.

Detailed values, source mappings and scanner logs remain in ignored private
submission-audit storage. Public evidence contains aggregate counts/provenance,
never individual answers, email addresses, respondent IDs or personal links.
