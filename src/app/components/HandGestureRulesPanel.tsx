import { useLanguage } from "../context/LanguageContext";
import type { HandGestureRuleItem } from "../i18n/translations";

function RuleRow({ rule }: { rule: HandGestureRuleItem }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="w-11 shrink-0 select-none text-center text-[2rem] leading-none"
        aria-hidden
      >
        {rule.emoji}
      </span>
      <span className="min-w-0 pt-1.5 text-sm leading-snug text-foreground">
        {rule.text}
      </span>
    </li>
  );
}

function RuleSection({
  title,
  rules,
}: {
  title: string;
  rules: readonly HandGestureRuleItem[];
}) {
  return (
    <section>
      <h3 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-foreground/65">
        {title}
      </h3>
      <ul className="flex flex-col gap-2.5">
        {rules.map((rule, index) => (
          <RuleRow key={`${rule.emoji}-${index}`} rule={rule} />
        ))}
      </ul>
    </section>
  );
}

export function HandGestureRulesPanel() {
  const { messages } = useLanguage();
  const { layout } = messages;

  return (
    <div className="flex flex-col gap-4 pr-7 pt-0.5">
      <p className="text-sm leading-snug text-muted-foreground">
        {layout.handGestureAwaitPalm}
      </p>
      <RuleSection
        title={layout.handGestureRulesGalleryTitle}
        rules={layout.handGestureRulesGallery}
      />
      <RuleSection
        title={layout.handGestureRulesDetailTitle}
        rules={layout.handGestureRulesDetail}
      />
    </div>
  );
}
