# Quobby Website Blog Design

## Objective

Add a discoverable blog to the Quobby website and publish a first article that explains Quobby and Qurator's study features, then compares their combined use case with Quizlet, Anki, and Duolingo. Position Quobby as the stronger all-round study companion for learners who want several study workflows together, without claiming it is objectively superior in every competitor's specialty.

## Current Site

- The Quobby website is a static site served from `docs/` on GitHub Pages.
- The main landing page and supporting pages share hand-authored HTML and CSS.
- `docs/robots.txt` permits crawling and references `docs/sitemap.xml`.
- The homepage already exposes app-store links and describes the Quobby and Qurator features.
- There is no existing blog index, article template, or content management system.

## Proposed Structure

- Add `docs/blog/index.html` as the blog landing page with a featured article card.
- Add `docs/blog/quobby-vs-quizlet-anki-duolingo.html` as the first article.
- Add a small “From the blog” section on the Quobby homepage that links to the article.
- Add Blog links to the shared navigation and footer on the homepage, support, privacy, and terms pages.
- Reuse the existing stylesheet, store links, brand colours, and responsive layout. Add only the blog-specific styles needed for article typography, comparison table, source list, and mobile table behavior.

## Article Direction

**Working title:** “Quobby vs. Quizlet, Anki, and Duolingo: One App for More of Your Study Day”

The article will cover:

1. Flashcards, spaced repetition, review modes, imports, and community decks.
2. AI vocabulary generation and translation, document scanning to flashcards, handwritten notes, and mind maps.
3. Focus sessions, app blocking, habits, progress, rewards, group study, mind maps, document scanning and classroom quizzes.
4. Accessibility support and the seven supported interface languages.
5. Qurator's interactive tutorials, branching paths, tutor/creator publishing, and paid tutorials.
6. A comparison table describing each competitor's strengths and where Quobby's broader toolset is a better fit.

The comparison will be feature-based, not a claim of better educational outcomes. It will credit Quizlet's study modes and AI tools, Anki's configurable spaced-repetition workflow and sync, and Duolingo's structured language lessons and motivation features. The article will explain that Quobby's advantage is breadth: it connects study materials, practice, focus, collaboration, accessibility, and tutorials in one companion app. It will avoid claiming Quobby replaces a specialist tool for every learner or subject.

Official competitor references to cite in the article:

- [Quizlet Help: Studying on Quizlet](https://help.quizlet.com/hc/en-us/articles/360030841732-Studying-on-Quizlet)
- [Anki Manual: Syncing with AnkiWeb](https://docs.ankiweb.net/syncing.html)
- [Duolingo Blog: How to Use Duolingo for Language Learning](https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/)

## Metadata and Discovery

- Add unique title, description, canonical URL, Open Graph/Twitter metadata, and `Article` JSON-LD to the post.
- Add the blog index and article URLs to `docs/sitemap.xml` with their publication/update date.
- Add the blog index and article links to `docs/llms.txt`.
- Keep `docs/robots.txt` unchanged: it already permits site crawling and points crawlers to the sitemap.
- Do not add the external app-store URLs as sitemap entries; the sitemap lists Quobby website pages.

## Acceptance Criteria

- Visitors can open the blog from site navigation, the homepage teaser, and the footer links.
- The blog index lists the first article, and the article links back to Quobby, Qurator, and both app stores.
- The comparison is clear and persuasive while accurately recognizing each competitor's specialty.
- The article's competitor claims have links to official sources.
- Both new site URLs are in the sitemap and `llms.txt`; robots rules continue to allow them.
- Layout remains readable on mobile, including the comparison table.

## Out of Scope

- CMS, authoring dashboard, comments, RSS, analytics changes, or a multi-article editorial calendar.
- Claims that Quobby has better learning outcomes than competitors without comparative evidence.
- Changes to the iOS or Android apps.
