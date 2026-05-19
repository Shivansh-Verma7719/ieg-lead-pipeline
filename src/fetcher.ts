import axios from 'axios';

const NEWS_API_KEY = process.env.NEWS_API_KEY;

export interface Article {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: { name: string };
  content: string;
}

export async function fetchStartupNews(): Promise<Article[]> {
  if (!NEWS_API_KEY) throw new Error("NEWS_API_KEY is not set");

  // Calculate dates - fetch news from the last 30 days
  const date = new Date();
  date.setDate(date.getDate() - 30);
  const fromDate = date.toISOString().split('T')[0];

  // NewsAPI 'everything' endpoint
  const url = `https://newsapi.org/v2/everything`;
  
  // Highly targeted query to capture Indian startup funding news
  const q = `("startup" OR "startups") AND "India" AND ("funding" OR "raised" OR "seed" OR "venture capital")`;

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
          apiKey: NEWS_API_KEY
        }
      });

      const articles = response.data.articles || [];
      allArticles = allArticles.concat(articles);

      const totalResults = response.data.totalResults || 0;
      if (allArticles.length >= totalResults || articles.length < pageSize || page >= 5) {
        break;
      }
      
      page++;
    }

    return allArticles;
  } catch (error: any) {
    if (error.response?.status === 426) {
      console.warn("NewsAPI Developer Plan limit reached (max 100 results). Returning collected articles.");
      return allArticles;
    }
    console.error("Error fetching news:", error);
    return allArticles;
  }
}
