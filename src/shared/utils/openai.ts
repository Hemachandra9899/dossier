import OpenAI from "openai";

let openaiInstance: OpenAI | null = null;

/**
 * Returns the lazily-initialized OpenAI client instance.
 * Throws an error if OPENAI_API_KEY is not defined when first invoked.
 */
export function getOpenAI(): OpenAI {
  if (openaiInstance) {
    return openaiInstance;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  openaiInstance = new OpenAI({
    apiKey,
  });

  return openaiInstance;
}

/**
 * A proxy wrapper that lazily delegates all properties and method calls to the
 * active OpenAI client instance. Retains full backward compatibility with eager imports.
 */
export const openai = new Proxy({} as OpenAI, {
  get(target, prop, receiver) {
    const client = getOpenAI();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
