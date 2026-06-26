import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  console.error("[bootstrap] #root not found — cannot mount React.");
} else {
  try {
    createRoot(rootEl).render(<App />);
  } catch (err) {
    console.error("[bootstrap] createRoot/render failed:", err);
    throw err;
  }
}
