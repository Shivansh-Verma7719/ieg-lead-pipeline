import { Client } from "@notionhq/client";
import type { ExtractedData } from "./extractor";
import type { Article } from "./fetcher";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DB_ID!;
let cachedDataSourceId: string | null = null;

async function getDataSourceId(): Promise<string> {
  if (cachedDataSourceId) return cachedDataSourceId;
  const db = await notion.databases.retrieve({ database_id: databaseId });
  cachedDataSourceId = (db as any).data_sources[0].id;
  return cachedDataSourceId!;
}

export async function checkNotionDuplicate(companyName: string): Promise<string | null> {
  if (!databaseId) throw new Error("NOTION_DB_ID is not set");

  try {
    const dataSourceId = await getDataSourceId();
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        property: "Company Name",
        title: {
          equals: companyName,
        },
      },
    });

    const firstResult = response.results[0];
    if (firstResult) {
      return firstResult.id;
    }
    return null;
  } catch (error) {
    console.error("Error querying Notion for duplicate:", error);
    return null;
  }
}

export async function appendSourceToNotion(pageId: string, articleUrl: string) {
  try {
    await notion.blocks.children.append({
      block_id: pageId,
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: `Additional Source: `,
                }
              },
              {
                type: "text",
                text: {
                  content: articleUrl,
                  link: { url: articleUrl }
                }
              }
            ]
          }
        }
      ]
    });
  } catch (error) {
    console.error("Error appending source to Notion:", error);
  }
}

export async function createNotionEntry(data: ExtractedData, article: Article) {
  if (!databaseId) throw new Error("NOTION_DB_ID is not set");

  try {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        "Company Name": {
          title: [{ text: { content: data.companyName } }],
        },
        "Round Stage": {
          select: { name: data.roundStage || "Series A" },
        },
        "Amount Raised": {
          rich_text: [{ text: { content: data.amountRaised || "Unknown" } }],
        },
        "Lead Investor": {
          rich_text: [{ text: { content: data.leadInvestor || "Unknown" } }],
        },
        "Other Investors": {
          rich_text: [{ text: { content: data.otherInvestors.join(", ") || "None" } }],
        },
        "Sector": {
          select: { name: data.sector || "Unspecified" },
        },
        "Country / Region": {
          select: { name: data.country || "India" },
        },
        "Announcement Date": {
          date: { start: new Date(article.publishedAt).toISOString() },
        },
        "Source Link": {
          url: article.url,
        },
        "Short Summary": {
          rich_text: [{ text: { content: data.summary || "" } }],
        },
        "Status": {
          status: { name: "Not started" },
        },
      },
    });
  } catch (error) {
    console.error("Error creating Notion entry:", error);
    // Print detailed error from Notion API if available
    if (error && typeof error === 'object' && 'body' in error) {
       console.error("Notion API Error Body:", error.body);
    }
  }
}
