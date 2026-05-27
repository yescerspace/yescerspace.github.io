import { Link, useLocation } from "react-router";
import { useLanguage } from "../context/LanguageContext";
import { SHELL_NAV_LABEL_CLASSNAME } from "../shellNavLabel";
import { cn } from "./ui/utils";

export function FooterNav() {
  const location = useLocation();
  const { messages } = useLanguage();
  const { nav } = messages;

  const links = [
    { path: "/", label: nav.gallery },
    { path: "/about", label: nav.about },
    { path: "/connect", label: nav.contact },
  ];

  return (
    <footer className="border-t border-border bg-app-shell-bg px-7 pb-6 pt-3.5 sm:px-12 sm:pb-7 sm:pt-4 lg:px-14 lg:pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4 sm:gap-5">
        <nav
          className="flex flex-wrap gap-5"
          aria-label={messages.aria.primaryNavigation}
        >
          {links.map((link) => {
            const segs = location.pathname
              .replace(/\/+$/, "")
              .split("/")
              .filter(Boolean);
            const isWorkDetail =
              segs.length === 2 &&
              segs[0] !== "about" &&
              segs[0] !== "connect" &&
              segs[0] !== "contact";
            const active =
              link.path === "/"
                ? location.pathname === "/" || isWorkDetail
                : location.pathname === link.path;

            return (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  SHELL_NAV_LABEL_CLASSNAME,
                  "transition-colors duration-200",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div
          className="flex select-none items-center gap-4 text-muted-foreground/35"
          aria-hidden
        >
          <span className="inline-block h-2 w-2 rounded-full border border-dashed border-muted-foreground/40 opacity-80" />
          <span className="text-xs leading-none tracking-[0.3em] text-muted-foreground/35">
            ···
          </span>
        </div>
      </div>
    </footer>
  );
}
