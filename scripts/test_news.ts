import { config } from "dotenv";
config();
import axios from 'axios';

async function test(q: string) {
  const url = `https://newsapi.org/v2/everything`;
  const response = await axios.get(url, {
    params: {
      q,
      language: 'en',
      sortBy: 'publishedAt',
      apiKey: process.env.NEWS_API_KEY
    }
  });
  console.log(`Query: ${q}`);
  console.log(`Found ${response.data.totalResults} articles.`);
  const articles = response.data.articles || [];
  for (let i = 0; i < Math.min(5, articles.length); i++) {
    console.log(`- ${articles[i].title}`);
  }
  console.log("---");
}

async function run() {
  await test(`+startup +India (+funding OR +"seed" OR +"Series" OR +"venture capital")`);
  await test(`("startup" OR "startups") AND "India" AND ("funding" OR "raised" OR "seed" OR "venture capital")`);
  await test(`"India" AND ("startup funding" OR "seed funding" OR "Series A" OR "Series B" OR "venture capital")`);
}

run().catch(e => console.error(e.response?.data || e.message));
