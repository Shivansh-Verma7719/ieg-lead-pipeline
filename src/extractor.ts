import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import type { Article } from "./fetcher";

const llm = new ChatGoogleGenerativeAI({
  model: "gemma-4-31b-it",
  temperature: 0,
  apiKey: process.env.GEMINI_API_KEY,
});

export const extractedDataSchema = z.object({
  isIndianFunding: z.boolean().describe("True if the article is about an Indian startup raising ANY funding round (Seed, Pre-Series A, Series A, Series B, etc.)."),
  companyName: z.string().describe("Name of the startup that raised funding."),
  roundStage: z.string().describe("The funding round, e.g., 'Series A', 'Seed', etc."),
  amountRaised: z.string().describe("The amount raised, e.g., '$15 million'."),
  leadInvestor: z.string().describe("The main investor leading the round."),
  otherInvestors: z.array(z.string()).describe("Other participating investors."),
  sector: z.string().describe("The industry or category of the company."),
  country: z.string().describe("The country where the startup is based. Should be India."),
  summary: z.string().describe("A short one-line summary of the funding event."),
});

export type ExtractedData = z.infer<typeof extractedDataSchema>;

const structuredLlm = llm.withStructuredOutput(extractedDataSchema);

export async function extractFundingDetails(article: Article): Promise<ExtractedData | null> {
  const contentToAnalyze = `
    Title: ${article.title}
    Description: ${article.description}
    Content Snippet: ${article.content}
  `;

  try {
    const result = await structuredLlm.invoke(`
      Extract the startup funding details from the following news article. 
      Only return data if it is ANY funding round (Seed, Pre-Series A, Series A, etc.) for a startup based in India.
      If it's not an Indian startup, or not a funding round, set 'isIndianFunding' to false.

      Article Text:
      ${contentToAnalyze}
    `);

    if (!result.isIndianFunding) {
      return null;
    }

    return result;
  } catch (error) {
    console.error(`Error extracting data for article: ${article.title}`, error);
    return null;
  }
}
