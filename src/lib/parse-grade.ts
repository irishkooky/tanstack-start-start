export type Grade = {
  comment: string;
  score: number | null;
};

const SCORE_PATTERN = /SCORE:\s*(\d+)/g;

/**
 * 採点ストリームの生テキストを「コメント本文」と「0〜100 のスコア」に分解する。
 *
 * Anthropic には「最後の行に SCORE: <0-100>」を出すよう指示しているが、
 * コメント中に SCORE 文字列が紛れることがあるため、最後の出現を正とする。
 * SCORE がまだ来ていない（ストリーミング途中）なら score は null。
 */
export function parseGrade(raw: string): Grade {
  const matches = [...raw.matchAll(SCORE_PATTERN)];
  const last = matches.at(-1);

  if (last?.[1] === undefined || last.index === undefined) {
    return { comment: raw.trim(), score: null };
  }

  const score = Math.min(100, Number.parseInt(last[1], 10));
  const comment = (raw.slice(0, last.index) + raw.slice(last.index + last[0].length)).trim();

  return { comment, score };
}
