export class ContentStudioConflictError extends Error {
  constructor() { super('Content Studio state changed; refresh and try again'); }
}

export class ContentStudioInputError extends Error {}

// Stock search or AI caption generation failed; messages are curated and safe to show.
export class MemeGenerationError extends Error {}
