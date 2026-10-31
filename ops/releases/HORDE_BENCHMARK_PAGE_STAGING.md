# Horde benchmark page staging

This page is an unpublished interface preview. The public GET `/api/horde-benchmark-stats` is proposed and is not connected or called. The only fetch is the explicitly requested synthetic example fixture under `tests/fixtures/`, which the Pages workflow excludes from the public artifact. No real reporter records, credentials, submission or compatibility data are used.

The local example adapter bounds `limit` to 1–100, validates an allowlist of filters and alphabetical sorts, and treats a future cursor as opaque and bounded. Its fixture has no next page. These local names and fixture shape are not a claim that the proposed server response schema is finalized. Before connecting a real service, jointly review its exact query and response contract, server-side privacy filtering, CORS, moderation, cache rules, missing-data handling and pagination. Do not silently substitute client filtering as a privacy boundary.

All examples are invented and visibly labeled. Provisional or unknown-revision rows are displayed separately; they are not ranked. Report counts are not people or devices, and GPU duration is not display FPS. The default unavailable, loading, empty-filter and error states must remain honest. The public noindex page and test fixtures must not be deployed until the separate owner publication and backend/privacy decisions are complete.
