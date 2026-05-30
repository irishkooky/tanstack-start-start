import { createServerFn } from "@tanstack/react-start";

export type GradeInput = {
  question: string;
  answer: string;
};

/**
 * 採点を「コメント（ストリーミング）→ 最後に SCORE: <0-100>」の生テキストで返す。
 * createServerFn のハンドラが Response を返すと、TanStack Start はそれを
 * シリアライズせず素通しするので、ReadableStream をそのままクライアントへ流せる。
 *
 * いまは配管検証用の偽ストリーム。Anthropic への fetch に差し替える予定。
 */
export const gradeAnswer = createServerFn({ method: "POST" })
  .inputValidator((data: GradeInput) => data)
  .handler(async ({ data }) => {
    const fakeComment =
      `「${data.question}」への回答を読みました。` +
      "着眼点は良く、要点を押さえています。" +
      "具体例を一つ足すと、説得力がさらに増すはずです。";

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        // コメントを数文字ずつ流してタイプライター感を出す
        for (const char of [...fakeComment]) {
          controller.enqueue(encoder.encode(char));
          await sleep(25);
        }
        // 最後の行にスコアだけ
        controller.enqueue(encoder.encode("\nSCORE: 78"));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  });

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
