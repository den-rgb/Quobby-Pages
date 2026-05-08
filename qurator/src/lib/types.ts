export type TutorialStatus = 'draft' | 'published' | 'archived';
export type StepType = 'content' | 'logic';
export type GameComplexity = 1 | 2 | 3 | 4 | 5;
export type ComponentType =
  | 'card' | 'token' | 'die' | 'board' | 'meeple' | 'tile' | 'marker'
  | 'image' | 'diagram' | 'annotation' | 'label' | 'other';
export type VariableType = 'number' | 'string' | 'boolean';
export type InteractiveElementType = 'multiple_choice' | 'tap_continue' | 'timer' | 'text_input';

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string;
  sort_order: number;
  created_at: string;
}

export interface MediaAttachment {
  id: string;
  url: string;
  type: 'image' | 'video';
  filename: string;
  size_bytes: number;
}

export interface Game {
  id: string;
  title: string;
  bgg_id: number | null;
  bgg_image_url: string | null;
  description: string;
  complexity: GameComplexity;
  min_players: number;
  max_players: number;
  play_time_minutes: number;
  year_published: number | null;
  created_at: string;
}

export interface Tutorial {
  id: string;
  game_id: string | null;
  category_id: string | null;
  creator_id: string;
  title: string;
  description: string;
  cover_image_url?: string | null;
  estimated_minutes: number;
  status: TutorialStatus;
  version: number;
  forked_from: string | null;
  rating_avg: number;
  rating_count: number;
  play_count: number;
  created_at: string;
  updated_at: string;
  game?: Game;
  category?: Category;
  creator?: { display_name: string; avatar_emoji: string };
}

export interface CodeBlock {
  code: string;
  language: string;
  filename?: string;
}

export interface ContentStepPayload {
  heading: string;
  body: string;
  image_url?: string;
  media?: MediaAttachment[];
  code_block?: CodeBlock;
  tip?: string;
  interactive?: InteractiveElement;
  board_view?: BoardViewConfig;
  is_setup_step?: boolean;
}

export type BoardType = 'hex_grid' | 'rect_grid' | 'row_layout' | 'custom';

export interface BoardCell {
  id: string;
  label?: string;
  color: string;
  icon?: string;
  tooltip?: string;
  highlight?: boolean;
}

export interface BoardPiece {
  id: string;
  cell_id: string;
  label?: string;
  color: string;
  shape: 'circle' | 'triangle' | 'square' | 'diamond' | 'star';
  tooltip?: string;
}

export type CanvasElementType = 'shape' | 'text' | 'image';
export type CanvasShape =
  | 'rectangle' | 'circle' | 'triangle' | 'diamond' | 'star' | 'hexagon'
  | 'meeple' | 'dice' | 'card' | 'token' | 'pawn' | 'cube' | 'flag' | 'crown';

export interface CanvasElement {
  id: string;
  type: CanvasElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  label?: string;
  shape?: CanvasShape;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  imageUrl?: string;
}

export interface BoardViewConfig {
  type: BoardType;
  cols: number;
  rows: number;
  cells: BoardCell[];
  pieces: BoardPiece[];
  title?: string;
  highlight_cells?: string[];
  canvas_elements?: CanvasElement[];
  canvas_width?: number;
  canvas_height?: number;
}

export interface InteractiveElement {
  type: InteractiveElementType;
  question?: string;
  options?: { label: string; correct: boolean }[];
  explanation?: string;
}

export interface LogicCondition {
  variable: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte';
  value: string | number | boolean;
}

export interface LogicStepPayload {
  prompt: string;
  conditions: {
    label: string;
    condition: LogicCondition;
    target_step_id: string;
    sets_variable?: { name: string; value: string | number | boolean };
  }[];
  default_target_step_id: string;
  default_label: string;
}

export interface TutorialStep {
  id: string;
  tutorial_id: string;
  step_type: StepType;
  sort_order: number;
  content_json: ContentStepPayload | null;
  logic_json: LogicStepPayload | null;
  position_x: number;
  position_y: number;
}

export interface TutorialConnection {
  id: string;
  from_step_id: string;
  to_step_id: string;
  condition_json: LogicCondition | null;
}

export interface TutorialObject {
  id: string;
  tutorial_id: string;
  name: string;
  component_type: ComponentType;
  image_url: string | null;
  properties_json: Record<string, unknown>;
}

export interface TutorialVariable {
  id: string;
  tutorial_id: string;
  name: string;
  variable_type: VariableType;
  default_value: string;
}

export interface UserTutorialProgress {
  user_id: string;
  tutorial_id: string;
  current_step_id: string;
  variables_state_json: Record<string, unknown>;
  started_at: string;
  last_played_at: string;
  completed_at: string | null;
}

export interface TutorialRating {
  user_id: string;
  tutorial_id: string;
  stars: number;
  review_text: string;
  created_at: string;
  profiles?: { display_name: string; avatar_emoji: string };
}

export interface BGGSearchResult {
  id: number;
  name: string;
  year_published: number | null;
  image: string | null;
  thumbnail: string | null;
  description: string;
  min_players: number;
  max_players: number;
  playing_time: number;
  average_weight: number;
  dbId?: string;
}
