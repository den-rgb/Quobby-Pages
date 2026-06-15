import { getPublishedCatalog } from '@/lib/seo';

export async function GET() {
  const catalog = await getPublishedCatalog();
  const gameLines = catalog.games
    .slice(0, 40)
    .map((g) => `- How to play ${g.title}: https://qurator.quobby.com/tutorials/${g.tutorialId}`)
    .join('\n');
  const recipeLines = catalog.recipes
    .slice(0, 20)
    .map((r) => `- ${r.title}: https://qurator.quobby.com/tutorials/${r.tutorialId}`)
    .join('\n');

  const catalogSection = [
    gameLines && `## Published board game tutorials\n\n${gameLines}`,
    recipeLines && `## Published recipe tutorials\n\n${recipeLines}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const content = `# Qurator - by Quobby

> Qurator is a free, community-driven platform for creating and following interactive, step-by-step tutorials on any topic.

## What is Qurator?

Qurator (https://qurator.quobby.com) lets anyone build interactive tutorials using a visual drag-and-drop flow editor. Tutorials support branching logic, comprehension quizzes, board game visualisations, embedded videos (upload or paste YouTube/Vimeo links), and code blocks. Learners follow guided walkthroughs rather than reading static text.

Qurator is built by the Quobby team and complements the Quobby mobile app.

## Key Features

- **Visual Flow Editor**: Drag-and-drop node editor for creating tutorial steps with branching logic.
- **Any Topic**: Board games, cooking, DIY, software, music, sports, science, and more.
- **Community-Driven**: Anyone can publish, rate, review, fork, and improve tutorials.
- **Interactive Elements**: Multiple-choice quizzes, branching paths, and variable-driven logic.
- **Board Game Designer**: Built-in hex/grid board designer for board game tutorials.
- **Video Processing**: Upload videos up to 1 GB or paste YouTube/Vimeo links. Premium users can split long videos into timeline-based segments that auto-create linked steps.
- **Embeddable**: Tutorials can be embedded on any website via iframe.
- **Free to Use**: Creating and following tutorials is free. Premium adds video splitting and analytics.

## Who Should Use Qurator?

- Teachers and educators creating interactive lesson plans
- Board game enthusiasts teaching game rules
- Cooking enthusiasts sharing recipes as step-by-step guides
- Software developers creating onboarding tutorials
- Musicians teaching techniques or songs
- DIY creators sharing project walkthroughs
- Anyone who wants to teach something interactively

## Categories

Board Games, Cooking, DIY & Crafts, Software, Music, Sports, Science

${catalogSection ? `${catalogSection}\n\n` : ''}## Links

- Browse tutorials: https://qurator.quobby.com/tutorials
- Create a tutorial: https://qurator.quobby.com/create
- Qurator home: https://qurator.quobby.com

---

# Quobby - Smart Flashcards & Study Tools

> Quobby is a free mobile study companion app available on iOS, featuring flashcards with spaced repetition, document scanning, handwritten notes, habit tracking, a focus timer, group study sessions, and gamification.

## What is Quobby?

Quobby (https://www.quobby.com) is an all-in-one study app designed to make learning fun and effective. It combines multiple study tools into a single app with gamification, social features, and accessibility support.

## Key Features

- **Flashcards & Spaced Repetition**: Create flashcards with text, images, voice recordings, and example sentences. Study with flip cards, multiple-choice quizzes, or typing practice. Spaced repetition algorithm optimises review intervals.
- **Language Learning**: AI-powered vocabulary generation in 21+ languages with auto-translate and text-to-speech.
- **Document Scanner**: Scan textbooks and worksheets with word-level OCR precision. Auto-generate flashcards from scanned text using AI.
- **Handwritten Notes**: Create notes with pen, pencil, marker, and highlighter tools. Use templates, shapes, rulers, and themed backgrounds. Export as image or PDF.
- **Habit Tracker**: Build study habits with daily tracking, streaks, and calendar views.
- **Focus Timer**: Pomodoro and Full Block mode with app blocking. Track on Lock Screen and Dynamic Island via Live Activity (iOS).
- **Group Study**: Challenge friends in real-time sessions with a 6-digit code. Private Sessions and Classroom Quizzes with live leaderboards and Teacher Mode.
- **Mind Maps**: Visualise and organise knowledge with interactive mind maps.
- **Gamification**: XP, levels, 25 achievements, global leaderboards, daily challenges, and daily prize boxes with themes, avatars, frames, and boosts.
- **Import**: Import from Anki, Quizlet, or CSV/JSON files.
- **Community Decks**: Browse, download, rate, and share flashcard decks with learners worldwide.
- **Dyslexia Support**: Dyslexia fonts, bionic reading, reading tints, syllable hints, reading ruler, and calm study mode.
- **Available in 7 Languages**: English, Chinese, French, German, Spanish, Polish, and Ukrainian.

## Who Should Use Quobby?

- Students preparing for exams
- Language learners building vocabulary
- Teachers creating classroom quizzes
- Anyone building study habits
- Learners who benefit from accessibility features (dyslexia support, reading aids)

## Platforms

- iOS: https://apps.apple.com/ie/app/quobby/id6758044478

- Website: https://www.quobby.com

## Pricing

Free to download and use. Premium subscription unlocks cloud sync, unlimited decks, AI generation, document scanning, and more.

## Contact

Email: helpmequobby@gmail.com
Instagram: https://www.instagram.com/quobby.official/
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
