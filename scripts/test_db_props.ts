import { config } from "dotenv";
config();
import { Client } from "@notionhq/client";

async function test() {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const databaseId = process.env.NOTION_DB_ID!;
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const dataSourceId = db.data_sources[0].id;
  const ds = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  console.log(JSON.stringify(ds, null, 2));
}
test().catch(console.error);
