import { useCallback, useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../context/LanguageContext";
import {
  CONTACT_EMAIL,
  CONTACT_SOCIAL_LINKS,
  type ContactSocialLinkId,
  FORMSPREE_ENDPOINT,
} from "../config/contact";
import { cn } from "../components/ui/utils";
import artstationIconUrl from "../assets/artstation.png?url";
import behanceIconUrl from "../assets/behance.png?url";

const SOCIAL_ICONS: Record<ContactSocialLinkId, string> = {
  artstation: artstationIconUrl,
  behance: behanceIconUrl,
};

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm text-foreground outline-none transition-[box-shadow,border-color] placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25";

const labelClass = "block text-[0.8rem] font-medium text-foreground/85";

const emailCtaBaseClass =
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full px-5 py-2 text-xs font-medium tracking-wide transition-[background-color,border-color,color,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]";

const emailMailtoPrimaryClass = cn(
  emailCtaBaseClass,
  "min-w-[8.5rem] bg-primary text-primary-foreground hover:opacity-90",
);

const emailMailtoAckClass = cn(
  emailCtaBaseClass,
  "min-w-[8.5rem] border border-border bg-muted/50 text-foreground hover:bg-muted",
);

const emailCopyPrimaryClass = cn(
  emailCtaBaseClass,
  "w-[8rem] bg-primary text-primary-foreground hover:opacity-90",
);

const emailCopyChipClass = cn(
  emailCtaBaseClass,
  "w-[8rem] border border-border bg-muted/50 text-foreground hover:bg-muted",
);

function ContactSocialRow({
  href,
  ariaLabel,
  iconUrl,
  label,
}: {
  href: string;
  ariaLabel: string;
  iconUrl: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className="group inline-flex w-fit max-w-full items-center gap-3.5 rounded-md transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <img
        src={iconUrl}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-md object-contain"
        decoding="async"
        loading="eager"
      />
      <span className="text-sm text-muted-foreground transition-colors group-hover:text-foreground">
        {label}
      </span>
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
          <p className="whitespace-pre-line text-base font-normal italic leading-relaxed text-muted-foreground">
            {c.headline}
          </p>
          {c.description.trim() ? (
            <p className="text-base text-muted-foreground">{c.description}</p>
          ) : null}
        </div>

        {!FORMSPREE_ENDPOINT && c.noFormNote.trim() ? (
          <p className="max-w-lg text-sm text-muted-foreground">{c.noFormNote}</p>
        ) : null}

        <div className="border-t border-border pt-8">
          <div className="flex flex-col items-start gap-8">
            {c.rolesLine.trim() ? (
              <p className="max-w-md text-[0.8rem] leading-snug text-muted-foreground">
                {c.rolesLine}
              </p>
            ) : null}

            <div className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-2.5 text-sm text-foreground">
              <a
                href={mailtoHref}
                className={emailMeAck ? emailMailtoAckClass : emailMailtoPrimaryClass}
                onClick={onMailtoClick}
              >
                {c.emailCta}
              </a>
              <span className="text-muted-foreground">{c.emailInlineOr}</span>
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
            </div>

            <ul className="mt-1 flex flex-col items-start gap-4">
              {CONTACT_SOCIAL_LINKS.map((link) => (
                <li key={link.id}>
                  <ContactSocialRow
                    href={link.href}
                    iconUrl={SOCIAL_ICONS[link.iconKey]}
                    label={link.label}
                    ariaLabel={c[link.ariaLabelKey]}
                  />
                </li>
              ))}
            </ul>
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
