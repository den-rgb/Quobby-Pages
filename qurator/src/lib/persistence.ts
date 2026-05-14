import { useEditorStore } from './store';
import { createClient } from './supabase/client';
import type {
  Category,
  ContentStepPayload,
  Game,
  Tutorial,
  TutorialConnection,
  TutorialObject,
  TutorialStep,
  TutorialVariable,
} from './types';

function estimateReadTime(steps: TutorialStep[]): number {
  const WORDS_PER_MIN = 200;
  const SECS_PER_IMAGE = 10;
  const SECS_PER_VIDEO = 30;
  const SECS_PER_INTERACTIVE = 15;
  const SECS_PER_CODE_BLOCK = 20;
  const SECS_PER_BOARD = 15;

  let totalSeconds = 0;

  for (const step of steps) {
    if (step.step_type !== 'content' || !step.content_json) continue;
    const c = step.content_json as ContentStepPayload;

    const text = [c.heading, c.body, c.tip].filter(Boolean).join(' ');
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    totalSeconds += (wordCount / WORDS_PER_MIN) * 60;

    if (c.image_url) totalSeconds += SECS_PER_IMAGE;
    if (c.media) {
      for (const m of c.media) {
        totalSeconds += m.video_url ? SECS_PER_VIDEO : SECS_PER_IMAGE;
      }
    }
    if (c.interactive) totalSeconds += SECS_PER_INTERACTIVE;
    if (c.code_block) totalSeconds += SECS_PER_CODE_BLOCK;
    if (c.board_view) totalSeconds += SECS_PER_BOARD;
  }

  return Math.max(1, Math.round(totalSeconds / 60));
}

export async function saveTutorial(userId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const state = useEditorStore.getState();
  const { tutorial, game, steps, connections, variables, objects } = state;

  if (!tutorial) return { error: 'No tutorial to save' };

  try {
    let gameId = tutorial.game_id;

    if (game) {
      if (game.bgg_id) {
        const { data: existing } = await supabase
          .from('games')
          .select('id')
          .eq('bgg_id', game.bgg_id)
          .maybeSingle();
        if (existing) {
          gameId = existing.id;
        }
      } else if (!game.bgg_id) {
        const { data: existing } = await supabase
          .from('games')
          .select('id')
          .ilike('title', game.title)
          .is('bgg_id', null)
          .maybeSingle();
        if (existing) {
          gameId = existing.id;
        }
      }

      if (!gameId) {
        const { data: inserted, error: insErr } = await supabase
          .from('games')
          .insert({
            title: game.title,
            bgg_id: game.bgg_id ?? null,
            bgg_image_url: game.bgg_image_url ?? null,
            description: game.description ?? '',
            complexity: game.complexity ?? 2,
            min_players: game.min_players ?? 1,
            max_players: game.max_players ?? 4,
            play_time_minutes: game.play_time_minutes ?? 30,
            year_published: game.year_published ?? null,
          })
          .select('id')
          .single();

        if (insErr) return { error: `Game save failed: ${insErr.message}` };
        gameId = inserted.id;
      }
    }

    const tutorialRow = {
      id: tutorial.id,
      game_id: gameId || null,
      category_id: tutorial.category_id || null,
      creator_id: userId,
      title: tutorial.title,
      description: tutorial.description,
      estimated_minutes: estimateReadTime(steps),
      status: tutorial.status,
      version: tutorial.version,
      forked_from: tutorial.forked_from,
      updated_at: new Date().toISOString(),
    };

    const { error: tutErr } = await supabase
      .from('tutorials')
      .upsert(tutorialRow, { onConflict: 'id' });

    if (tutErr) return { error: `Tutorial save failed: ${tutErr.message}` };

    const stepRows = steps.map((s) => ({
      id: s.id,
      tutorial_id: tutorial.id,
      step_type: s.step_type,
      sort_order: s.sort_order,
      content_json: s.content_json,
      logic_json: s.logic_json,
      position_x: s.position_x,
      position_y: s.position_y,
    }));

    const connRows = connections.map((c) => ({
      id: c.id,
      from_step_id: c.from_step_id,
      to_step_id: c.to_step_id,
      condition_json: c.condition_json,
    }));

    const objRows = objects.map((o) => ({
      id: o.id,
      tutorial_id: tutorial.id,
      name: o.name,
      component_type: o.component_type,
      image_url: o.image_url,
      properties_json: o.properties_json,
    }));

    const varRows = variables.map((v) => ({
      id: v.id,
      tutorial_id: tutorial.id,
      name: v.name,
      variable_type: v.variable_type,
      default_value: v.default_value,
    }));

    const { error: saveErr } = await supabase.rpc('save_tutorial_data', {
      p_tutorial_id: tutorial.id,
      p_steps: stepRows,
      p_connections: connRows,
      p_objects: objRows,
      p_variables: varRows,
    });

    if (saveErr) return { error: `Save failed: ${saveErr.message}` };

    useEditorStore.setState({ isDirty: false });
    return {};
  } catch (err) {
    return { error: `Unexpected error: ${(err as Error).message}` };
  }
}

export async function loadTutorial(
  tutorialId: string
): Promise<{ error?: string }> {
  const supabase = createClient();
  try {
    const { data: tutorial, error: tutErr } = await supabase
      .from('tutorials')
      .select('*')
      .eq('id', tutorialId)
      .single();

    if (tutErr || !tutorial)
      return { error: `Tutorial not found: ${tutErr?.message}` };

    let game: Game | null = null;
    if (tutorial.game_id) {
      const { data: g } = await supabase
        .from('games')
        .select('*')
        .eq('id', tutorial.game_id)
        .single();
      game = g as Game | null;
    }

    let category: Category | null = null;
    if (tutorial.category_id) {
      const { data: c } = await supabase
        .from('categories')
        .select('*')
        .eq('id', tutorial.category_id)
        .single();
      category = c as Category | null;
    }

    const { data: steps } = await supabase
      .from('tutorial_steps')
      .select('*')
      .eq('tutorial_id', tutorialId)
      .order('sort_order');

    const stepIds = (steps ?? []).map((s: TutorialStep) => s.id);

    let connections: TutorialConnection[] = [];
    if (stepIds.length > 0) {
      const { data: connData } = await supabase
        .from('tutorial_connections')
        .select('*')
        .in('from_step_id', stepIds);
      connections = (connData ?? []) as TutorialConnection[];
    }

    const { data: objects } = await supabase
      .from('tutorial_objects')
      .select('*')
      .eq('tutorial_id', tutorialId);

    const { data: variables } = await supabase
      .from('tutorial_variables')
      .select('*')
      .eq('tutorial_id', tutorialId);

    useEditorStore.setState({
      tutorial: tutorial as Tutorial,
      game,
      category,
      steps: (steps ?? []) as TutorialStep[],
      connections,
      objects: (objects ?? []) as TutorialObject[],
      variables: (variables ?? []) as TutorialVariable[],
      isDirty: false,
      selectedStepId: null,
    });

    return {};
  } catch (err) {
    return { error: `Load failed: ${(err as Error).message}` };
  }
}
