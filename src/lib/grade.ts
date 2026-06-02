import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

export type GradeInput = {
  question: string;
  answer: string;
};

// 採点用は速さ重視。プランで指定された Sonnet 系の現行モデル。
const MODEL = "claude-sonnet-4-6";

/**
 * 採点を「コメント（ストリーミング）→ 最後の行に SCORE: <0-100>」の生テキストで返す。
 *
 * createServerFn のハンドラが Response を返すと、TanStack Start はそれを
 * シリアライズせず素通しする（X-TSS-RAW-RESPONSE）ので、ReadableStream を
 * そのままクライアントへ流せる。
 *
 * Anthropic SDK ではなく fetch で直接叩く（workerd で確実に動かすため）。
 * API キーはサーバー（workerd）の env からのみ読み、ブラウザには出ない。
 */
export const gradeAnswer = createServerFn({ method: "POST" })
  .inputValidator((data: GradeInput) => data)
  .handler(async ({ data }) => {
    // 本番(workerd)では cloudflare:workers の env が届かない場合があるため、
    // nodejs_compat 経由の process.env もフォールバックで見る。
    const apiKey = env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return textResponse("ANTHROPIC_API_KEY が設定されていません。", 500);
    }

    const prompt =
      `お題:「${data.question}」\n` +
      `回答:「${data.answer}」\n\n` +
      "この回答を採点してください。まず2〜3文で良い点と改善点を述べ、" +
      "最後の行に必ず「SCORE: <0-100の整数>」だけを出力してください。";

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return textResponse(`採点に失敗しました (${upstream.status})。${detail}`, 502);
    }

    // Anthropic の SSE を読み、text_delta のテキストだけを自前のストリームへ流す。
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buffer = "";
        try {
          for (;;) {
            // ストリームは逐次読み取りが正しい（並列化できない）
            // oxlint-disable-next-line react-doctor/async-await-in-loop
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // SSE は行単位。各 data: 行が独立した JSON。
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? ""; // 最後の不完全行は次回に持ち越す
            for (const line of lines) {
              emitLine(line, controller, encoder);
            }
          }
        } catch (error) {
          controller.error(error);
          return;
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  });

function emitLine(
  line: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): void {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith("data:")) return;
  const payload = trimmed.slice("data:".length).trim();
  if (!payload || payload === "[DONE]") return;

  let event: { type?: string; delta?: { type?: string; text?: string } };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    return; // keepalive など非JSON行は無視
  }

  if (
    event.type === "content_block_delta" &&
    event.delta?.type === "text_delta" &&
    event.delta.text
  ) {
    controller.enqueue(encoder.encode(event.delta.text));
  }
}

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
