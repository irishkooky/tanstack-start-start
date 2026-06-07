import { describe, expect, it } from "vite-plus/test";

import { parseGrade } from "./parse-grade";

describe("parseGrade", () => {
  it("最終行の SCORE をスコアとして取り出し、コメントから除去する", () => {
    const raw = "良い回答です。具体性があります。\nSCORE: 85";
    expect(parseGrade(raw)).toEqual({
      comment: "良い回答です。具体性があります。",
      score: 85,
    });
  });

  it("SCORE がまだ来ていなければ score は null（ストリーミング途中）", () => {
    expect(parseGrade("採点中のコメントです")).toEqual({
      comment: "採点中のコメントです",
      score: null,
    });
  });

  it("コロンの後ろに空白が無くても拾う", () => {
    expect(parseGrade("コメント\nSCORE:72").score).toBe(72);
  });

  it("100 を超える値は 100 にクランプする", () => {
    expect(parseGrade("コメント\nSCORE: 150").score).toBe(100);
  });

  it("コメント中に SCORE 文字列が紛れても、最後の出現を採用する", () => {
    const raw = "最後の行に SCORE: を出力します。\nSCORE: 60";
    expect(parseGrade(raw)).toEqual({
      comment: "最後の行に  を出力します。",
      score: 60,
    });
  });

  it("空文字なら空コメント・スコア無し", () => {
    expect(parseGrade("")).toEqual({ comment: "", score: null });
  });
});
