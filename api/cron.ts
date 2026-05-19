import { fetchStartupNews } from "../src/fetcher";
import { extractFundingDetails } from "../src/extractor";
import { checkNotionDuplicate, appendSourceToNotion, createNotionEntry } from "../src/notion";
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel serverless function entrypoint
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Optional security: Verify Vercel Cron header if running on Vercel
  if (
    process.env.VERCEL_CRON_SECRET &&
    req.headers.authorization !== `Bearer ${process.env.VERCEL_CRON_SECRET}`
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("Starting Lead Sourcing Pipeline...");

  try {
    // 1. Fetch News
    const articles = await fetchStartupNews();
    console.log(`Found ${articles.length} articles matching search criteria.`);

    let processedCount = 0;
    let newLeadsCount = 0;

    // 2. Process each article
    for (const article of articles) {
      console.log(`Analyzing: ${article.title}`);
      
      // AI Extraction
      const extractedData = await extractFundingDetails(article);
      
      if (!extractedData) {
        console.log(`Skipped: Not an Indian Series A or low confidence.`);
        continue;
      }

      processedCount++;
      console.log(`Valid Lead Found: ${extractedData.companyName}`);

      // 3. Deduplication check
      const existingPageId = await checkNotionDuplicate(extractedData.companyName);

      if (existingPageId) {
        console.log(`Duplicate found for ${extractedData.companyName}. Appending source.`);
        await appendSourceToNotion(existingPageId, article.url);
      } else {
        console.log(`Creating new entry for ${extractedData.companyName}...`);
        await createNotionEntry(extractedData, article);
        newLeadsCount++;
        
        // Alerting left blank for now per user request
      }
    }

    console.log("Pipeline execution completed.");
    res.status(200).json({ 
      success: true, 
      articlesFetched: articles.length,
      validLeadsProcessed: processedCount,
      newLeadsCreated: newLeadsCount
    });

  } catch (error: any) {
    console.error("Pipeline failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
