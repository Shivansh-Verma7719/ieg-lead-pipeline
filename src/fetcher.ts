import axios from 'axios';
import type { AxiosResponse } from 'axios';

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;
const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const CURRENTS_API_KEY = process.env.CURRENTS_API_KEY;

export interface Article {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: { name: string };
  content: string;
}

export async function fetchStartupNews(): Promise<Article[]> {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  const fromDate = date.toISOString().split('T')[0] as string;

  const qNewsAPI = `("startup" OR "startups") AND "India" AND ("funding" OR "raised" OR "seed" OR "venture capital")`;
  const qGNews = `"startup" AND "India" AND ("funding" OR "raised" OR "seed")`;
  const qGeneral = `startup India funding`;

  const fetchers: { name: string; promise: Promise<Article[]> }[] = [];

  if (NEWS_API_KEY) {
    fetchers.push({ name: "NewsAPI", promise: fetchFromNewsAPI(NEWS_API_KEY, qNewsAPI, fromDate) });
  } else {
    console.warn("NEWS_API_KEY is not set. Skipping NewsAPI.");
  }

  if (GNEWS_API_KEY) {
    fetchers.push({ name: "GNews", promise: fetchFromGNews(GNEWS_API_KEY, qGNews, fromDate) });
  } else {
    console.warn("GNEWS_API_KEY is not set. Skipping GNews.");
  }

  if (NEWSDATA_API_KEY) {
    fetchers.push({ name: "NewsData.io", promise: fetchFromNewsData(NEWSDATA_API_KEY, qGeneral) });
  } else {
    console.warn("NEWSDATA_API_KEY is not set. Skipping NewsData.io.");
  }

  if (CURRENTS_API_KEY) {
    fetchers.push({ name: "Currents", promise: fetchFromCurrents(CURRENTS_API_KEY, qGeneral) });
  } else {
    console.warn("CURRENTS_API_KEY is not set. Skipping Currents API.");
  }

  if (fetchers.length === 0) {
    console.warn("No News API keys are set. Cannot fetch news.");
    return [];
  }

  const results = await Promise.allSettled(fetchers.map(f => f.promise));

  let allArticles: Article[] = [];
  results.forEach((result, i) => {
    const providerName = fetchers[i]!.name;
    if (result.status === 'fulfilled') {
      console.log(`  [${providerName}] ${result.value.length} articles fetched`);
      allArticles = allArticles.concat(result.value);
    } else {
      console.error(`  [${providerName}] Failed:`, result.reason);
    }
  });

  // Deduplicate articles by URL
  const uniqueArticlesMap = new Map<string, Article>();
  for (const article of allArticles) {
    if (article.url && !uniqueArticlesMap.has(article.url)) {
      uniqueArticlesMap.set(article.url, article);
    }
  }

  const unique = Array.from(uniqueArticlesMap.values()).sort((a, b) => {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  console.log(`  [Total] ${allArticles.length} raw -> ${unique.length} after deduplication`);
  return unique;
}

async function fetchFromNewsAPI(apiKey: string, q: string, fromDate: string): Promise<Article[]> {
  const url = `https://newsapi.org/v2/everything`;
  let allArticles: Article[] = [];
  let page = 1;
  const pageSize = 100;

  try {
    while (true) {
      const response = await axios.get(url, {
        params: {
          q,
          searchIn: 'title,description,content',
          from: fromDate,
          language: 'en',
          sortBy: 'publishedAt',
          pageSize,
          page,
          apiKey
        }
      });

      const articles = response.data.articles || [];
      allArticles = allArticles.concat(articles.map((a: any) => ({
        title: a.title || '',
        description: a.description || '',
        url: a.url || '',
        publishedAt: a.publishedAt || '',
        source: { name: a.source?.name || 'NewsAPI' },
        content: a.content || ''
      })));

      const totalResults = response.data.totalResults || 0;
      if (allArticles.length >= totalResults || articles.length < pageSize || page >= 5) {
        break;
      }
      
      page++;
    }
  } catch (error: any) {
    if (error.response?.status === 426) {
      console.warn("NewsAPI Developer Plan limit reached. Returning collected articles.");
    } else {
      console.error("Error fetching from NewsAPI:", error.response?.data || error.message);
    }
  }

  return allArticles;
}

async function fetchFromGNews(apiKey: string, q: string, fromDate: string): Promise<Article[]> {
  const url = `https://gnews.io/api/v4/search`;
  let allArticles: Article[] = [];
  // Free tier returns 10/request; cap at 10 pages (100 articles) to protect daily quota
  const MAX_PAGES = 10;
  const PAGE_SIZE = 10;
  const DELAY_MS = 1500; // GNews free tier has strict burst limits

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (page > 1) await new Promise(resolve => setTimeout(resolve, DELAY_MS));

      const response = await axios.get(url, {
        params: {
          q,
          lang: 'en',
          country: 'in',
          max: PAGE_SIZE,
          from: `${fromDate}T00:00:00Z`,
          apikey: apiKey,
          page
        }
      });

      const articles: any[] = response.data.articles || [];
      allArticles = allArticles.concat(articles.map((a: any) => ({
        title: a.title || '',
        description: a.description || '',
        url: a.url || '',
        publishedAt: a.publishedAt || '',
        source: { name: a.source?.name || 'GNews' },
        content: a.content || ''
      })));

      const totalArticles: number = response.data.totalArticles || 0;
      if (allArticles.length >= totalArticles || articles.length < PAGE_SIZE) break;
    }
  } catch (error: any) {
    const isRateLimit = error.response?.data?.errors?.some((e: string) =>
      e.toLowerCase().includes('too many requests')
    );
    if (isRateLimit) {
      console.warn(`  [GNews] Rate limited after ${allArticles.length} articles. Returning what was collected.`);
    } else {
      console.error("Error fetching from GNews:", error.response?.data || error.message);
    }
  }

  return allArticles;
}

async function fetchFromNewsData(apiKey: string, q: string): Promise<Article[]> {
  const url = `https://newsdata.io/api/1/news`;
  let allArticles: Article[] = [];
  let page: string | undefined = undefined;
  let fetches = 0;
  
  try {
    // Free tier: 200 credits/day; each page = 1 credit. Cap at 10 pages (100 articles).
    while (fetches < 10) {
      const response: AxiosResponse<any> = await axios.get(url, {
        params: {
          apikey: apiKey,
          q,
          language: 'en',
          country: 'in',
          page
        }
      });

      const results: any[] = response.data.results || [];
      allArticles = allArticles.concat(results.map((r: any) => ({
        title: r.title || '',
        description: r.description || '',
        url: r.link || '',
        publishedAt: r.pubDate || '',
        source: { name: r.source_name || 'NewsData.io' },
        content: r.content || ''
      })));

      page = response.data.nextPage;
      if (!page) break;
      fetches++;
    }
  } catch (error: any) {
    console.error("Error fetching from NewsData.io:", error.response?.data || error.message);
  }

  return allArticles;
}

async function fetchFromCurrents(apiKey: string, q: string): Promise<Article[]> {
  const url = `https://api.currentsapi.services/v1/search`;
  let allArticles: Article[] = [];
  // Free tier: 600 req/day. Cap at 10 pages to be safe.
  const MAX_PAGES = 10;
  let nextCursor: string | undefined = undefined;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const response: AxiosResponse<any> = await axios.get(url, {
        params: {
          keywords: q,
          language: 'en',
          country: 'IN',
          apiKey,
          ...(nextCursor ? { start_cursor: nextCursor } : {})
        }
      });

      const news: any[] = response.data.news || [];
      allArticles = allArticles.concat(news.map((n: any) => ({
        title: n.title || '',
        description: n.description || '',
        url: n.url || '',
        publishedAt: n.published || '',
        source: { name: n.author || 'Currents API' },
        content: n.description || ''
      })));

      nextCursor = response.data.next_cursor;
      if (!nextCursor || news.length === 0) break;
    }
  } catch (error: any) {
    console.error("Error fetching from Currents:", error.response?.data || error.message);
  }

  return allArticles;
}
