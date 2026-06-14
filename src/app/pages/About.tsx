import { useMemo } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../context/LanguageContext";

import { cn } from "../components/ui/utils";

/** DE (and other non-EN locales): slightly smaller so longer copy fits the layout. */
const aboutBioTextClassCompact =
  "text-[0.9375rem] leading-relaxed text-[#007FFF] sm:text-[1rem]";

/** EN only: one step larger — shorter copy reads less cramped. */
const aboutBioTextClassEn =
  "text-[1rem] leading-relaxed text-[#007FFF] sm:text-[1.0625rem]";

const aboutSidebarHeadingClass =
  "text-[0.875rem] leading-relaxed text-foreground sm:text-[0.9375rem]";

const aboutSidebarItemClass =
  "text-[0.8125rem] leading-[1.2] text-muted-foreground sm:text-[0.875rem]";

function AboutBulletSection({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-[1em] font-normal uppercase tracking-[0.14em]">
        {title}
      </h2>
      <ul className={`flex flex-col gap-[0.2em] ${aboutSidebarItemClass}`}>
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <span className="shrink-0 text-foreground" aria-hidden>
              ✦
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function About() {
  const { messages, locale } = useLanguage();
  const { about: a } = messages;
  const aboutBioTextClass =
    locale === "en" ? aboutBioTextClassEn : aboutBioTextClassCompact;

  const paragraphs = useMemo(
    () => [a.lead, a.p2, a.p3, a.p4, a.p5].filter((p) => p.trim().length > 0),
    [a.lead, a.p2, a.p3, a.p4, a.p5],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-6xl"
    >
      <div
        className={cn(
          "grid gap-y-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-x-12 xl:gap-x-20",
          aboutBioTextClass,
        )}
      >
        <div className="space-y-6 lg:col-start-1 lg:row-start-1">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        <aside
          className={`space-y-10 lg:col-start-2 lg:row-start-1 lg:self-start lg:pl-16 xl:pl-24 2xl:pl-32 ${aboutSidebarHeadingClass}`}
        >
          <AboutBulletSection
            title={a.proficienciesTitle}
            items={a.proficiencies}
          />
          <AboutBulletSection title={a.skillsTitle} items={a.skills} />
        </aside>
      </div>
    </motion.div>
  );
}
