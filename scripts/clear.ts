import { config } from "dotenv";
config();
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DB_ID!;

async function clearDatabase() {
  if (!databaseId) throw new Error("NOTION_DB_ID is not set");

  console.log("Fetching database...");
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const dataSourceId = (db as any).data_sources[0].id;
  
  let hasMore = true;
  let nextCursor: string | null = null;
  let deletedCount = 0;

  while (hasMore) {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: nextCursor || undefined,
    });

    for (const result of response.results) {
      if (result.id) {
        // Archive the page (sends it to trash)
        await notion.pages.update({
          page_id: result.id,
          in_trash: true,
        });
        deletedCount++;
        process.stdout.write(`\rDeleted ${deletedCount} pages...`);
      }
    }

    hasMore = response.has_more;
    nextCursor = response.next_cursor;
  }

  console.log(`\n✅ Database cleared! Total deleted: ${deletedCount}`);
}

clearDatabase().catch(console.error);
