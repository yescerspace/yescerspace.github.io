import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Order is fixed for nav and URLs, names are case-sensitive (e.g. "Interactive / VR"). */
export const GALLERY_CATEGORIES = [
  "Interactive / VR",
  "Motion",
  "Audiovisual Graphic Interaction",
  "3D Archive",
  "2D Archive",
  "New",
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

type WorksCategoryContextValue = {
  hoveredCategory: string | null;
  lockedCategory: string | null;
  setHoveredCategory: (category: string | null) => void;
  setLockedCategory: (category: string | null) => void;
  resetCategories: () => void;
};

const WorksCategoryContext = createContext<WorksCategoryContextValue | null>(
  null,
);

export function WorksCategoryProvider({ children }: { children: ReactNode }) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [lockedCategory, setLockedCategory] = useState<string | null>(null);

  const resetCategories = useCallback(() => {
    setHoveredCategory(null);
    setLockedCategory(null);
  }, []);

  const value = useMemo(
    () => ({
      hoveredCategory,
      lockedCategory,
      setHoveredCategory,
      setLockedCategory,
      resetCategories,
    }),
    [hoveredCategory, lockedCategory, resetCategories],
  );

  return (
    <WorksCategoryContext.Provider value={value}>
      {children}
    </WorksCategoryContext.Provider>
  );
}

export function useWorksCategory() {
  const ctx = useContext(WorksCategoryContext);
  if (!ctx) {
    throw new Error("useWorksCategory must be used within WorksCategoryProvider");
  }
  return ctx;
}
