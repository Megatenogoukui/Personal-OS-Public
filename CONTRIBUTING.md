# Contributing

Thank you for improving Personal OS.

## Development

1. Fork and clone the repository.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local`. Use a separate development database or the local store driver.
4. Create a focused branch.
5. Run `npm run typecheck`, `npm test`, and `npm run build` before opening a pull request.

## Pull requests

- Keep personal records, credentials, provider cookies, exports, and screenshots containing private information out of commits.
- Preserve provider-neutral work imports and self-hosted storage.
- Add focused tests for changes to scoring, parsing, analytics, or stored-data contracts.
- Describe data migrations and backward compatibility explicitly.
- Avoid unrelated formatting or generated-file churn.

## Data model changes

Personal OS stores a versioned document in MongoDB. New fields should have safe empty defaults in `packages/core/src/store.ts`, and readers must continue accepting documents written by older versions.
