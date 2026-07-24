import { buildAssistantContext } from "@/lib/chatContext";
import { aiLanguageName } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response("The AI assistant is not configured (missing API key).", { status: 500 });
  }

  let messages: ChatMessage[] = [];
  let locale = "en";
  try {
    const body = await req.json();
    locale = typeof body?.locale === "string" ? body.locale : "en";
    messages = (body?.messages ?? []).filter(
      (m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string"
    );
  } catch {
    return new Response("Invalid request.", { status: 400 });
  }

  // Keep only the last ~10 turns to stay within budget.
  messages = messages.slice(-10);

  const context = await buildAssistantContext();
  const language = aiLanguageName(locale);

  const system = `You are the Agent Farmer AI Assistant — a knowledgeable, friendly farming advisor for Indian farmers.

You have live memory of this farmer's data:
${context}

Guidelines:
- Reply ENTIRELY in ${language}. Use natural ${language} the farmer will understand. Keep crop names and units clear.
- Give practical, specific, actionable advice grounded in the farmer's actual crops, soil, irrigation, location and weather above.
- Be concise (2-5 short sentences or a tight bullet list). No fluff.
- Use ₹ for money and metric units. Assume Indian agriculture context.
- When weather implies action (rain, heat), say what to do and when.
- If asked about something outside the data, answer helpfully from general agronomy knowledge.
- Never invent farm data that isn't provided. If data is missing, say so briefly.`;

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.4,
      max_tokens: 700,
      stream: true,
    }),
  });

  if (!groqRes.ok || !groqRes.body) {
    const errText = await groqRes.text().catch(() => "");
    console.error("GROQ chat error:", groqRes.status, errText);
    return new Response("The AI engine is busy right now. Please try again in a moment.", {
      status: 502,
    });
  }

  // Transform Groq's SSE stream into a plain text delta stream for the client.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = groqRes.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const data = t.slice(5).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              /* ignore keep-alive / partial */
            }
          }
        }
      } catch (e) {
        console.error("GROQ stream error:", e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
