import { GoogleGenAI, type FunctionDeclaration } from "@google/genai";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let _client: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (_client) return _client;
  _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _client;
}

export function isLiveLLM(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

interface StructuredCallOpts {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  inputSchema: object;
  maxTokens?: number;
}

async function _structuredCallOnce<T>(opts: StructuredCallOpts): Promise<T> {
  const client = getGemini();
  if (!client) throw new Error("Gemini client unavailable (no GEMINI_API_KEY)");

  const functionDeclaration: FunctionDeclaration = {
    name: opts.toolName,
    description: opts.toolDescription,
    parameters: opts.inputSchema as FunctionDeclaration["parameters"],
  };

  const resp = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    config: {
      systemInstruction: opts.system,
      maxOutputTokens: opts.maxTokens ?? 4096,
      tools: [{ functionDeclarations: [functionDeclaration] }],
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY" as any,
          allowedFunctionNames: [opts.toolName],
        },
      },
    },
  });

  const calls = resp.functionCalls ?? [];
  const call = calls.find((c) => c.name === opts.toolName) ?? calls[0];
  
  // Handle case where model returns text content instead of function call
  if (!call || !call.args) {
    // Check if response has text content that might be parseable JSON
    const textContent = resp.text?.trim();
    if (textContent) {
      try {
        // Try to extract JSON from markdown code blocks or parse directly
        const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/) 
          || textContent.match(/(\{[\s\S]*\})/);
        const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : textContent;
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === 'object') {
          console.warn("[gemini] Model returned text instead of function call, parsed JSON fallback succeeded");
          return parsed as T;
        }
      } catch {
        // JSON parsing failed, fall through to error
      }
    }
    throw new Error("Model returned no function_call");
  }
  return call.args as T;
}

/**
 * Calls Gemini with a single forced function-call that captures structured JSON output.
 * Returns the parsed function-call args or throws.
 * Includes retry logic with exponential backoff for rate limiting.
 */
export async function structuredCall<T>(opts: StructuredCallOpts): Promise<T> {
  const maxRetries = 3;
  const baseDelayMs = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await _structuredCallOnce<T>(opts);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isRetryable =
        errorMessage.includes("429") ||
        errorMessage.includes("quota") ||
        errorMessage.includes("rate") ||
        errorMessage.includes("too many requests") ||
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("5") || // 5xx server errors
        errorMessage.includes("Internal Server Error");

      if (!isRetryable || attempt === maxRetries - 1) {
        throw err;
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt); // 1s, 2s, 4s
      console.warn(`[gemini] API call failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }

  throw new Error("structuredCall: exhausted all retries");
}
