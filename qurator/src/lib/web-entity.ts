const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const WIKI_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const WIKI_OPENSEARCH = 'https://en.wikipedia.org/w/api.php';
const UA = 'Qurator/1.0 (https://qurator.quobby.com; board game and recipe tutorials)';
const REVALIDATE = 60 * 60 * 24;
const FOODISH = /dish|recipe|cuisine|food|pasta|cook|ingredient|meal|sauce|soup|salad|bread|dessert|baking/i;

export type WebEntity = {
  wikipediaUrl: string | null;
  wikidataUrl: string | null;
  description: string | null;
};

const EMPTY: WebEntity = {
  wikipediaUrl: null,
  wikidataUrl: null,
  description: null,
};

function sanitizeSparqlLiteral(input: string): string {
  return input
    .replace(/[\\"\n\r\t{}()]/g, '')
    .slice(0, 100)
    .trim();
}

function wikipediaTitleFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const path = new URL(url).pathname;
    const title = path.split('/wiki/')[1];
    return title ? decodeURIComponent(title) : null;
  } catch {
    return null;
  }
}

function canonicalWikidataUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/(?:entity|wiki)\/(Q\d+)/i);
  return m ? `https://www.wikidata.org/wiki/${m[1]}` : url;
}

async function runSparql(query: string): Promise<Record<string, { value: string }>[]> {
  const res = await fetch(
    `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}`,
    {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(6000),
    },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data?.results?.bindings ?? [];
}

async function wikipediaSummary(titleOrUrl: string | null): Promise<WebEntity> {
  const title = titleOrUrl?.startsWith('http')
    ? wikipediaTitleFromUrl(titleOrUrl)
    : titleOrUrl;
  if (!title) return EMPTY;
  try {
    const res = await fetch(`${WIKI_SUMMARY}${encodeURIComponent(title.replace(/ /g, '_'))}`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return EMPTY;
    const data = await res.json();
    if (data?.type === 'disambiguation') return EMPTY;
    const extract = typeof data?.extract === 'string' ? data.extract.trim() : '';
    const wikipediaUrl =
      (typeof data?.content_urls?.desktop?.page === 'string' && data.content_urls.desktop.page) ||
      (typeof data?.content_urls?.mobile?.page === 'string' && data.content_urls.mobile.page) ||
      null;
    const qid = typeof data?.wikibase_item === 'string' ? data.wikibase_item : null;
    return {
      wikipediaUrl,
      wikidataUrl: qid ? `https://www.wikidata.org/wiki/${qid}` : null,
      description: extract ? extract.slice(0, 400) : null,
    };
  } catch {
    return EMPTY;
  }
}

async function wikipediaOpenSearch(query: string): Promise<string | null> {
  try {
    const url = `${WIKI_OPENSEARCH}?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const found = Array.isArray(data?.[3]) ? data[3][0] : null;
    return typeof found === 'string' ? found : null;
  } catch {
    return null;
  }
}

function bindEntity(row: Record<string, { value: string }> | undefined): WebEntity {
  if (!row) return EMPTY;
  return {
    wikipediaUrl: row.article?.value ?? null,
    wikidataUrl: canonicalWikidataUrl(row.item?.value ?? null),
    description: row.itemDescription?.value ?? null,
  };
}

export async function lookupBoardGameEntity(bggId: number | null | undefined): Promise<WebEntity> {
  if (!bggId || bggId <= 0) return EMPTY;
  try {
    const sparql = `SELECT ?item ?itemDescription ?article WHERE {
      ?item wdt:P2339 "${bggId}" .
      OPTIONAL {
        ?article schema:about ?item ;
                 schema:isPartOf <https://en.wikipedia.org/> .
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 1`;
    const rows = await runSparql(sparql);
    const entity = bindEntity(rows[0]);
    if (entity.wikipediaUrl) {
      const summary = await wikipediaSummary(entity.wikipediaUrl);
      if (summary.description) entity.description = summary.description;
      if (summary.wikidataUrl && !entity.wikidataUrl) entity.wikidataUrl = summary.wikidataUrl;
    }
    return entity;
  } catch {
    return EMPTY;
  }
}

/** Strip tutorial-style suffixes so Wikidata can match the dish name. */
export function recipeSearchName(title: string): string {
  return title
    .replace(/\s+quickstart.*$/i, '')
    .replace(/\s+\+\s+recommendations.*$/i, '')
    .replace(/\s+in\s+\d+\s+minutes?.*$/i, '')
    .replace(/^how to (make|cook|bake)\s+/i, '')
    .replace(/[:].*$/, '')
    .trim()
    .slice(0, 80);
}

export async function lookupRecipeEntity(title: string | null | undefined): Promise<WebEntity> {
  const name = recipeSearchName(title ?? '');
  const safe = sanitizeSparqlLiteral(name);
  if (safe.length < 3) return EMPTY;
  try {
    const sparql = `SELECT ?item ?itemLabel ?itemDescription ?article WHERE {
      {
        ?item rdfs:label "${safe}"@en .
      } UNION {
        ?item skos:altLabel "${safe}"@en .
      }
      ?item wdt:P31/wdt:P279* ?class .
      FILTER(?class IN (wd:Q746549, wd:Q19861951, wd:Q2095, wd:Q8195619))
      OPTIONAL {
        ?article schema:about ?item ;
                 schema:isPartOf <https://en.wikipedia.org/> .
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 1`;
    const rows = await runSparql(sparql);
    const entity = bindEntity(rows[0]);
    if (entity.wikipediaUrl) {
      const summary = await wikipediaSummary(entity.wikipediaUrl);
      if (summary.description) entity.description = summary.description;
      if (summary.wikidataUrl && !entity.wikidataUrl) entity.wikidataUrl = summary.wikidataUrl;
      return entity;
    }

    const wikiUrl = await wikipediaOpenSearch(name);
    if (!wikiUrl) return entity;
    const summary = await wikipediaSummary(wikiUrl);
    const blob = `${summary.description ?? ''} ${summary.wikipediaUrl ?? ''}`;
    if (!hasWebFindings(summary)) return entity;
    if (!FOODISH.test(blob) && !FOODISH.test(name) && !hasWebFindings(entity)) return EMPTY;
    return {
      wikipediaUrl: summary.wikipediaUrl,
      wikidataUrl: summary.wikidataUrl || entity.wikidataUrl,
      description: summary.description || entity.description,
    };
  } catch {
    return EMPTY;
  }
}

export function sameAsUrls(entity: WebEntity, extra: (string | null | undefined)[]): string[] {
  const urls = [...extra, entity.wikipediaUrl, entity.wikidataUrl];
  return [...new Set(urls.filter((u): u is string => !!u))];
}

export function hasWebFindings(entity: WebEntity): boolean {
  return !!(entity.wikipediaUrl || entity.wikidataUrl || entity.description);
}

export async function resolveTutorialWebEntity(opts: {
  isRecipe: boolean;
  bggId?: number | null;
  tutorialTitle: string;
}): Promise<WebEntity> {
  if (opts.isRecipe) return lookupRecipeEntity(opts.tutorialTitle);
  return lookupBoardGameEntity(opts.bggId);
}
