import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { LanguageProvider, useLanguage } from "../context/LanguageContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { FooterNav } from "./FooterNav";
import { cn } from "./ui/utils";

function LayoutShell() {
  const location = useLocation();
  const { pathname } = location;
  const { messages, locale } = useLanguage();
  const pathSegments = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const isGalleryDetail =
    pathSegments.length === 2 &&
    pathSegments[0] !== "about" &&
    pathSegments[0] !== "contact";
  const isGallery = pathname === "/" || isGalleryDetail;
  const isAboutOrContact = pathname === "/about" || pathname === "/contact";

  useEffect(() => {
    document.title = messages.layout.documentTitle;
  }, [messages.layout.documentTitle]);

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 overflow-hidden bg-background">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-5 px-7 pb-1 pt-5 sm:items-baseline sm:gap-6 sm:px-12 sm:pb-1.5 sm:pt-6 lg:px-14 lg:pt-7">
          <div className="flex min-w-0 flex-1 flex-col pr-2">
            {/*
              `lang="en"`: root `<html>` stays `lang="en"` for typography; Latin brand stays stable.
            */}
            <p
              lang="en"
              className="text-[calc(0.75rem+1pt)] font-semibold tracking-[0.22em] text-foreground sm:text-[calc(0.875rem+1pt)]"
            >
              {messages.layout.brandName}
            </p>
          </div>
          <div className="shrink-0">
            <LanguageSwitcher />
          </div>
        </header>

        <main
          lang={locale}
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            isGallery &&
              "overflow-hidden px-7 sm:px-12 lg:px-14",
            !isGallery &&
              !isAboutOrContact &&
              "overflow-y-auto px-7 pb-4 sm:px-12 lg:px-14",
            isAboutOrContact &&
              "overflow-y-auto px-10 pb-4 pt-8 sm:px-16 sm:pt-10 lg:px-20 lg:pt-12",
          )}
        >
          <Outlet />
        </main>

        <div className="shrink-0">
          <FooterNav />
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  return (
    <LanguageProvider>
      <LayoutShell />
    </LanguageProvider>
  );
}
