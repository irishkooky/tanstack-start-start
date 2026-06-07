import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { gradeAnswer } from "../lib/grade";
import { parseGrade } from "../lib/parse-grade";

export const Route = createFileRoute("/")({
  component: Home,
});

const QUESTION = "「最高のエンジニアとは？」を1〜2文で説明してください。";

type Status = "idle" | "grading" | "done";

function Home() {
  const [answer, setAnswer] = useState("");
  const [comment, setComment] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit() {
    if (!answer.trim() || status === "grading") return;
    setStatus("grading");
    setComment("");
    setScore(null);

    const res = await gradeAnswer({ data: { question: QUESTION, answer } });
    const body = res.body;
    if (!body) {
      setStatus("done");
      return;
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      // ストリームは逐次読み取りが正しい（並列化できない）
      // oxlint-disable-next-line react-doctor/async-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const { comment: parsedComment, score: parsedScore } = parseGrade(buffer);
      setComment(parsedComment);
      if (parsedScore !== null) setScore(parsedScore);
    }

    setStatus("done");
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center p-6">
      <div className="w-full space-y-6">
        <header className="space-y-1">
          <p className="text-sm font-medium text-indigo-500">お題</p>
          <h1 className="text-2xl leading-snug font-bold">{QUESTION}</h1>
        </header>

        <div className="space-y-3">
          <label htmlFor="answer" className="block text-sm font-medium text-gray-600">
            あなたの回答
          </label>
          <textarea
            id="answer"
            aria-label="あなたの回答"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            placeholder="ここに自由に書いてください…"
            className="w-full resize-none rounded-xl border border-gray-300 p-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={status === "grading" || !answer.trim()}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "grading" ? "採点中…" : "採点する"}
          </button>
        </div>

        {(status !== "idle" || comment) && (
          <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <ScoreGauge score={score} />
            <p className="min-h-6 leading-relaxed whitespace-pre-wrap text-gray-800">
              {comment}
              {status === "grading" && <span className="animate-pulse">▍</span>}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function ScoreGauge({ score }: { score: number | null }) {
  const value = score ?? 0;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-gray-500">スコア</span>
        <span className="text-4xl font-bold text-indigo-600 tabular-nums">
          {score === null ? "—" : value}
          <span className="text-lg text-gray-400">/100</span>
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-[width] duration-700 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
