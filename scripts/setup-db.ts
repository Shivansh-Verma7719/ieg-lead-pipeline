import { config } from "dotenv";
config();
import { Client } from "@notionhq/client";

async function setup() {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const databaseId = process.env.NOTION_DB_ID!;

  console.log("Fetching database...");
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const dataSourceId = ((db as any).data_sources)[0].id;

  console.log(`Updating data source ${dataSourceId}...`);
  await notion.dataSources.update({
    data_source_id: dataSourceId,
    properties: {
      "Name": {
        name: "Company Name",
        type: "title",
        title: {}
      },
      "Round Stage": {
        name: "Round Stage",
        type: "select",
        select: {}
      },
      "Amount Raised": {
        name: "Amount Raised",
        type: "rich_text",
        rich_text: {}
      },
      "Lead Investor": {
        name: "Lead Investor",
        type: "rich_text",
        rich_text: {}
      },
      "Other Investors": {
        name: "Other Investors",
        type: "rich_text",
        rich_text: {}
      },
      "Sector": {
        name: "Sector",
        type: "select",
        select: {}
      },
      "Country / Region": {
        name: "Country / Region",
        type: "select",
        select: {}
      },
      "Announcement Date": {
        name: "Announcement Date",
        type: "date",
        date: {}
      },
      "Source Link": {
        name: "Source Link",
        type: "url",
        url: {}
      },
      "Short Summary": {
        name: "Short Summary",
        type: "rich_text",
        rich_text: {}
      },
      "Status": {
        name: "Status",
        type: "status",
        status: {}
      },
      "Confidence Level": {
        name: "Confidence Level",
        type: "number",
        number: {}
      }
    }
  });

  console.log("✅ Database properties set up successfully!");
}

setup().catch(console.error);
