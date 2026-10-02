import type { Noticed as NoticedRemark, PieceLanguage } from "@ink/schemas";
import { noticedLine, noticedSentence } from "../lib/noticed";
import type { SeasonSet } from "../lib/seasons";

const LANG: Record<PieceLanguage, string | undefined> = { en: "en", hi: "hi", "hi-Latn": undefined, mixed: undefined };

// A quiet remark: the writer's own older line, then one plain sentence from Ink. Nothing in it is
// an action, so it is not a button, a link or a card.
export function Noticed({ noticed, seasonSet }: { noticed: NoticedRemark; seasonSet: SeasonSet }) {
  const line = noticedLine(noticed);
  if (!line) return null;
  return (
    <div className="mt-6 border-b border-line pb-5">
      <p lang={noticed.note.language ? LANG[noticed.note.language] : undefined} className="m-0 font-serif text-[15px] leading-[21px] text-ink italic">
        {line}
      </p>
      <p className="m-0 mt-1 text-[13px] leading-[18px] text-ink-muted">{noticedSentence(noticed, seasonSet)}</p>
    </div>
  );
}
