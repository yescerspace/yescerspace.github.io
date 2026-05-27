import { useCallback, useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../context/LanguageContext";
import {
  ARTSTATION_PROFILE_URL,
  BEHANCE_PROFILE_URL,
  CONTACT_EMAIL,
  FORMSPREE_ENDPOINT,
} from "../config/contact";
import { cn } from "../components/ui/utils";
import artstationIconUrl from "../assets/artstation.png?url";
import behanceIconUrl from "../assets/behance.png?url";

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm text-foreground outline-none transition-[box-shadow,border-color] placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25";

const labelClass = "block text-[0.8rem] font-medium text-foreground/85";

/** Mailto + social icon links — shared height and primary colors. */
const contactCtaShellClass =
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md bg-primary py-1 text-primary-foreground transition-[background-color,border-color,color,opacity] duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]";

/** Mailto CTA — primary slab. */
const emailMailtoPrimaryClass = cn(
  contactCtaShellClass,
  "min-w-[8.5rem] px-2 text-xs font-medium tracking-wide",
);

/** Mailto tıklanınca Copy “Copied!” ile aynı görünüm (metin değişmez). */
const emailMailtoAckClass =
  "inline-flex min-w-[8.5rem] shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-muted/50 px-2 py-1 text-xs font-medium tracking-wide text-foreground transition-[background-color,border-color,color] duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]";

/** Copy / Copied: same fixed width in both states (fits EN/DE/TR feedback text). */
const emailCopyPrimaryClass =
  "inline-flex w-[8rem] shrink-0 items-center justify-center rounded-md bg-primary px-2 py-1 text-xs font-medium tracking-wide text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const emailCopyChipClass =
  "inline-flex w-[8rem] shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Pre-colored logo PNGs — no tint/background overlay. */
const contactSocialIconLinkClass =
  "inline-flex shrink-0 rounded-md transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function ContactSocialIconLink({
  href,
  ariaLabel,
  iconUrl,
}: {
  href: string;
  ariaLabel: string;
  iconUrl: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className={contactSocialIconLinkClass}
    >
      <img
        src={iconUrl}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 object-contain"
        decoding="async"
      />
    </a>
  );
}

export function Contact() {
  const { messages } = useLanguage();
  const c = messages.contact;
  const mailtoHref = `mailto:${encodeURIComponent(CONTACT_EMAIL)}`;
  const [emailCopied, setEmailCopied] = useState(false);
  const [emailMeAck, setEmailMeAck] = useState(false);

  const onMailtoClick = useCallback(() => {
    setEmailMeAck(true);
    window.setTimeout(() => setEmailMeAck(false), 2000);
  }, []);

  const copyEmailToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setEmailCopied(true);
      window.setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      setEmailCopied(false);
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="max-w-3xl"
    >
      <div className="space-y-8 leading-relaxed text-muted-foreground">
        <div className="space-y-6">
          <div className="space-y-5">
            <p className="whitespace-pre-line text-base font-normal italic leading-relaxed text-muted-foreground">
              {c.headline}
            </p>
            {c.description.trim() ? (
              <p className="text-base text-muted-foreground">{c.description}</p>
            ) : null}
          </div>
        </div>

        {!FORMSPREE_ENDPOINT && c.noFormNote.trim() ? (
          <p className="max-w-lg text-sm text-muted-foreground">{c.noFormNote}</p>
        ) : null}

        <div className="border-t border-border pt-8">
          <div className="flex flex-col items-start gap-3">
            {c.rolesLine.trim() ? (
              <p className="mb-6 max-w-md text-[0.8rem] leading-snug text-muted-foreground">
                {c.rolesLine}
              </p>
            ) : null}
            <div className="flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-2.5 text-sm leading-relaxed text-foreground">
              <span className="inline-flex items-baseline gap-2">
                <a
                  href={mailtoHref}
                  className={emailMeAck ? emailMailtoAckClass : emailMailtoPrimaryClass}
                  onClick={onMailtoClick}
                >
                  {c.emailCta}
                </a>
                <span className="ml-1 text-muted-foreground">{c.emailInlineOr}</span>
              </span>
              <span className="inline-flex min-w-0 max-w-full items-baseline gap-2">
                <button
                  type="button"
                  onClick={copyEmailToClipboard}
                  className={cn(
                    emailCopied ? emailCopyChipClass : emailCopyPrimaryClass,
                    emailCopied ? "cursor-default" : "cursor-pointer",
                  )}
                >
                  {emailCopied ? c.emailCopiedFeedback : c.copyEmail}
                </button>
              </span>
            </div>
            {/* Two lines under the CTA row */}
            <div className="mt-5 flex items-center gap-3.5">
              <ContactSocialIconLink
                href={ARTSTATION_PROFILE_URL}
                ariaLabel={c.artStationProfileAriaLabel}
                iconUrl={artstationIconUrl}
              />
              <ContactSocialIconLink
                href={BEHANCE_PROFILE_URL}
                ariaLabel={c.behanceProfileAriaLabel}
                iconUrl={behanceIconUrl}
              />
            </div>
          </div>
        </div>

        {FORMSPREE_ENDPOINT ? (
          <div className="border-t border-border pt-10">
            <form
              action={FORMSPREE_ENDPOINT}
              method="POST"
              className="max-w-lg space-y-5"
            >
              <input type="hidden" name="_subject" value={c.formSubject} />
              <div>
                <label htmlFor="contact-name" className={labelClass}>
                  {c.nameLabel}
                </label>
                <input
                  id="contact-name"
                  type="text"
                  name="name"
                  required
                  autoComplete="name"
                  className={fieldClass}
                  placeholder={c.placeholderName}
                />
              </div>
              <div>
                <label htmlFor="contact-email" className={labelClass}>
                  {c.emailLabel}
                </label>
                <input
                  id="contact-email"
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  className={fieldClass}
                  placeholder={c.placeholderEmail}
                />
              </div>
              <div>
                <label htmlFor="contact-message" className={labelClass}>
                  {c.messageLabel}
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  rows={5}
                  className={`${fieldClass} min-h-[120px] resize-y`}
                  placeholder={c.placeholderMessage}
                />
              </div>
              <button
                type="submit"
                className="rounded-full border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {c.send}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
