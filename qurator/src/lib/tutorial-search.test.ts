import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner needs the explicit .ts extension.
import { matchesTutorialSearch } from './tutorial-search.ts';

test('finds a board-game tutorial when the query includes a generic tutorial term', () => {
  assert.equal(
    matchesTutorialSearch(
      {
        title: 'Terraforming Mars: First Game',
        description: 'A guided first game with setup and turn structure.',
        gameTitle: 'Terraforming Mars',
        categoryName: 'Board Games',
      },
      'terraforming mars tutorial',
    ),
    true,
  );
});

test('finds a cooking tutorial when the query uses recipe language', () => {
  assert.equal(
    matchesTutorialSearch(
      {
        title: 'Pasta Aglio e Olio in 20 Minutes',
        description: 'A classic Roman pasta with six ingredients.',
        categoryName: 'Cooking',
      },
      'pasta aglio e olio recipe',
    ),
    true,
  );
});

test('does not match an unrelated tutorial', () => {
  assert.equal(
    matchesTutorialSearch(
      {
        title: 'Pasta Aglio e Olio in 20 Minutes',
        description: 'A classic Roman pasta with six ingredients.',
        categoryName: 'Cooking',
      },
      'terraforming mars tutorial',
    ),
    false,
  );
});
