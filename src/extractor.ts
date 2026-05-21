import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import type { Article } from "./fetcher";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3.1-flash-lite",
  temperature: 0,
  apiKey: process.env.GEMINI_API_KEY,
});

export const extractedDataSchema = z.object({
  isIndianFunding: z
    .boolean()
    .describe(
      "True if the article is about an Indian startup raising ANY funding round (Seed, Pre-Series A, Series A, Series B, etc.).",
    ),
  companyName: z.string().describe("Name of the startup that raised funding."),
  roundStage: z
    .string()
    .describe("The funding round, e.g., 'Series A', 'Seed', etc."),
  amountRaised: z.string().describe("The amount raised, e.g., '$15 million'."),
  leadInvestor: z.string().describe("The main investor leading the round."),
  otherInvestors: z
    .array(z.string())
    .describe("Other participating investors."),
  sector: z.string().describe("The industry or category of the company."),
  country: z
    .string()
    .describe("The country where the startup is based. Should be India."),
  summary: z
    .string()
    .describe("A short one-line summary of the funding event."),
});

export type ExtractedData = z.infer<typeof extractedDataSchema>;

export async function extractFundingDetails(
  article: Article,
): Promise<ExtractedData | null> {
  const contentToAnalyze = `
    Title: ${article.title}
    Description: ${article.description}
    Content Snippet: ${article.content}
  `;

  // Helper: try to extract JSON object from model text, tolerant of stray/backtick fences
  function extractJsonText(text: string) {
    if (!text) return null;
    // Remove lone backticks and code fences
    let t = text.replace(/```/g, "").replace(/`/g, "");
    // If the model wrapped output in a code block like ```json ... ``` this will remove them.
    // Try to locate the first { and last } to extract a JSON object
    const first = t.indexOf("{");
    const last = t.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      return t.slice(first, last + 1);
    }
    // Fallback: return trimmed text
    return t.trim();
  }

  try {
    const prompt = `
      Extract the startup funding details from the following news article. 
      Only return data if it is ANY funding round (Seed, Pre-Series A, Series A, etc.) for a startup based in India.
      If it's not an Indian startup, or not a funding round, set 'isIndianFunding' to false.

      Article Text:
      ${contentToAnalyze}
    `;

    const aiMsg = await llm.invoke(prompt);
    const raw = (aiMsg as any).content ?? String(aiMsg);

    const jsonText = extractJsonText(raw as string);
    if (!jsonText) {
      console.error(
        `Unable to extract JSON from LLM response for article: ${article.title}`,
      );
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      console.error(
        `JSON.parse failed on extracted text for article: ${article.title}`,
        jsonText,
        e,
      );
      return null;
    }

    const fit = extractedDataSchema.safeParse(parsed);
    if (!fit.success) {
      console.error(
        `Zod schema validation failed for article: ${article.title}`,
        fit.error,
      );
      return null;
    }

    if (!fit.data.isIndianFunding) return null;

    return fit.data;
  } catch (error) {
    console.error(`Error extracting data for article: ${article.title}`, error);
    return null;
  }
}
