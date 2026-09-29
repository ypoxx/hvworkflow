# Fixture spec for the metrics allowlist gate tests

Synthetic. Every fixture name below is listed here on purpose, so that a red result comes from the
rule under test and not from a missing spec entry (rule (c) holds even with an entry).

## Kennzahlen-Allowlist

- `hv_by_subject` — labels `subject_hash`
- `hv_answers_per_actor`
- `hv_user_open_questions` — labels `meeting_id`, `unit_id`
- `hv_rate_limit_rejections`
- `hv_by_track` — labels `track`
- `hv_twice`
- `hv_by_ip_address` — labels `meeting_id`
- `hv_ok_but_listed_only_here`

## Weiteres

`hv_not_in_allowlist_section`
