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

const structuredLlm = llm.withStructuredOutput(extractedDataSchema);

export async function extractFundingDetails(
  article: Article,
): Promise<ExtractedData | null> {
  const contentToAnalyze = `
    Title: ${article.title}
    Description: ${article.description}
    Content Snippet: ${article.content}
  `;

  function extractJsonText(text: string) {
    const trimmedText = text.trim();
    return (
      trimmedText.match(/^```(?:json)?\s*([\s\S]*?)```/)?.[1] ||
      trimmedText.match(/```json\s*([\s\S]*?)```/)?.[1] ||
      trimmedText.replace(/```/g, "").replace(/`/g, "").trim()
    );
  }

  try {
    const prompt = `
      Extract the startup funding details from the following news article. 
      Only return data if it is ANY funding round (Seed, Pre-Series A, Series A, etc.) for a startup based in India.
      If it's not an Indian startup, or not a funding round, set 'isIndianFunding' to false.

      Article Text:
      ${contentToAnalyze}
    `;

    const result = await structuredLlm.invoke(prompt);

    if (!result.isIndianFunding) {
      return null;
    }

    return result;
  } catch (error) {
    // Minimal fallback for rare parser failures caused by fence formatting.
    try {
      const fallback = await llm.invoke(`
        Return ONLY valid JSON object. Do not use markdown code fences.
        Keys required: isIndianFunding, companyName, roundStage, amountRaised, leadInvestor, otherInvestors, sector, country, summary.

        Article Text:
        ${contentToAnalyze}
      `);

      const raw = String((fallback as any).content ?? "");
      const jsonText = extractJsonText(raw);
      const parsed = extractedDataSchema.safeParse(JSON.parse(jsonText));
      if (!parsed.success || !parsed.data.isIndianFunding) return null;
      return parsed.data;
    } catch {
      // Keep original logging path below.
    }

    console.error(`Error extracting data for article: ${article.title}`, error);
    return null;
  }
}
