import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner needs the explicit .ts extension.
import { buildTutorialSeoIntro } from './tutorial-seo-intro.ts';

test('publishes the tutorial summary and first instructional step in server markup', () => {
  assert.deepEqual(
    buildTutorialSeoIntro({
      title: 'Learn Catan in 10 Minutes',
      description: 'A complete walkthrough of Catan for first-time players.',
      steps: [
        { heading: 'Welcome to Catan!', body: 'Build settlements, trade resources, and reach ten victory points.' },
        { heading: 'Board Setup', body: 'Arrange the terrain tiles.' },
      ],
    }),
    {
      title: 'Learn Catan in 10 Minutes',
      description: 'A complete walkthrough of Catan for first-time players.',
      firstStep: {
        heading: 'Welcome to Catan!',
        body: 'Build settlements, trade resources, and reach ten victory points.',
      },
    },
  );
});

test('omits an empty first step without hiding the tutorial summary', () => {
  assert.deepEqual(
    buildTutorialSeoIntro({
      title: 'Pasta Aglio e Olio in 20 Minutes',
      description: 'A classic Roman pasta with six ingredients.',
      steps: [{ heading: 'Ingredients', body: '' }],
    }),
    {
      title: 'Pasta Aglio e Olio in 20 Minutes',
      description: 'A classic Roman pasta with six ingredients.',
      firstStep: null,
    },
  );
});
