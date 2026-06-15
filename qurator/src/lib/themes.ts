export const THEME_STORAGE_KEY = 'qurator-theme';

export const THEME_IDS = [
  'dark',
  'light',
  'ocean',
  'forest',
  'sunset',
  'midnight',
  'rose',
  'cherry_blossom',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = 'dark';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  background: string;
  card: string;
  accent: string;
  secondary: string;
}

/** Palettes match Quobby iOS/Android AppThemeManager (named themes) plus Qurator dark/light. */
export const THEMES: ThemeOption[] = [
  {
    id: 'dark',
    name: 'Qurator Dark',
    description: 'Default magenta night theme',
    background: '#0a0a14',
    card: '#1a1a28',
    accent: '#a1306b',
    secondary: '#b8ff6b',
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Clean light surfaces',
    background: '#F2F2F7',
    card: '#FFFFFF',
    accent: '#a1306b',
    secondary: '#2E7D32',
  },
  {
    id: 'ocean',
    name: 'Ocean Depths',
    description: 'Deep blue ocean theme',
    background: '#0A1628',
    card: '#132F4C',
    accent: '#29B6F2',
    secondary: '#64FFDA',
  },
  {
    id: 'forest',
    name: 'Forest Green',
    description: 'Calming forest theme',
    background: '#0D1F12',
    card: '#1B3D24',
    accent: '#66BB6A',
    secondary: '#FFD54F',
  },
  {
    id: 'sunset',
    name: 'Sunset Glow',
    description: 'Warm sunset colors',
    background: '#2C1810',
    card: '#4A2C1E',
    accent: '#FF8A65',
    secondary: '#FFD180',
  },
  {
    id: 'midnight',
    name: 'Midnight Purple',
    description: 'Deep purple night theme',
    background: '#1A0D24',
    card: '#321B45',
    accent: '#B388FF',
    secondary: '#FF80AB',
  },
  {
    id: 'rose',
    name: 'Rose Gold',
    description: 'Elegant rose gold accents',
    background: '#1F1218',
    card: '#3D2430',
    accent: '#F8BBD9',
    secondary: '#CE93D8',
  },
  {
    id: 'cherry_blossom',
    name: 'Cherry Blossom',
    description: 'Soft pink cherry blossom theme',
    background: '#1C0E15',
    card: '#331D2C',
    accent: '#FFB7C5',
    secondary: '#B8D4E3',
  },
];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId);
}

export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{if(location.pathname.indexOf('/embed/')===0)return;var t=localStorage.getItem('${THEME_STORAGE_KEY}');var ids=${JSON.stringify(THEME_IDS)};if(t&&ids.indexOf(t)!==-1)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
