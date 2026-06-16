import { useLanguage } from "../context/LanguageContext";
import type { HandGestureRuleItem } from "../i18n/translations";
import handSwipePageImg from "../assets/hand-swipe-page.png";
import handEscKeyImg from "../assets/hand-gesture-esc-key.png";
import { cn } from "./ui/utils";

const RULE_IMAGE_SRC = {
  swipePage: handSwipePageImg,
  escKey: handEscKeyImg,
} as const;

function isPairRule(rule: HandGestureRuleItem): boolean {
  return rule.emojis.length > 1 || (rule.imageKey != null && rule.emojis.length > 0);
}

function RuleGlyphs({ rule }: { rule: HandGestureRuleItem }) {
  const pair = isPairRule(rule);
  const box = pair ? "h-6 w-6" : "h-7 w-7";
  const emojiSize = pair ? "text-[1.125rem]" : "text-[1.375rem]";

  return (
    <div
      className="flex flex-row flex-nowrap items-center justify-end gap-px"
      aria-hidden
    >
      {rule.imageKey ? (
        <img
          src={RULE_IMAGE_SRC[rule.imageKey]}
          alt=""
          className={cn(box, "shrink-0 object-contain")}
          decoding="async"
        />
      ) : null}
      {rule.emojis.map((emoji, emojiIndex) => (
        <span
          key={`${emoji}-${emojiIndex}`}
          className={cn(
            "inline-flex shrink-0 items-center justify-center leading-none",
            box,
            emojiSize,
            emoji === "✊" && !pair && "scale-[0.88]",
          )}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}

export function HandGestureRulesPanel() {
  const { messages } = useLanguage();
  const { layout } = messages;
  const rules = layout.handGestureRules;

  return (
    <div className="flex flex-col gap-4 pt-0.5">
      <p className="text-base leading-snug text-white">
        {layout.handGestureAwaitPalm}
      </p>
      <section>
        <h3 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-foreground/65">
          {layout.handGestureRulesBookTitle}
        </h3>
        <div className="flex gap-x-5">
          <div
            className="flex w-[3.75rem] shrink-0 flex-col items-end gap-3"
            role="list"
          >
            {rules.map((rule, index) => (
              <div
                key={`glyph-${rule.label}-${index}`}
                className="flex min-h-7 items-center justify-end"
                role="listitem"
              >
                <RuleGlyphs rule={rule} />
              </div>
            ))}
          </div>

          <div className="w-px shrink-0 self-stretch bg-foreground/25" aria-hidden />

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {rules.map((rule, index) => (
              <p
                key={`label-${rule.label}-${index}`}
                className="flex min-h-7 items-center text-sm leading-snug text-foreground"
              >
                {rule.label}
              </p>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
