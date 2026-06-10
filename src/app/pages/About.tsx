import { motion } from "motion/react";
import { useLanguage } from "../context/LanguageContext";

export function About() {
  const { messages } = useLanguage();
  const { about: a } = messages;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="max-w-3xl"
    >
      <div className="space-y-6 leading-relaxed text-muted-foreground">
        <p>{a.lead}</p>
        <p>{a.p2}</p>
        <p>{a.p3}</p>
      </div>
    </motion.div>
  );
}
