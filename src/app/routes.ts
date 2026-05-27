import { createBrowserRouter, redirect } from "react-router";
import { Layout } from "./components/Layout";
import { Works } from "./pages/Works";
import { About } from "./pages/About";
import { Contact } from "./pages/Contact";

const routes = [
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Works },
      { path: "about", Component: About },
      { path: "connect", Component: Contact },
      /** Legacy bookmark — `/contact` → `/connect`. */
      { path: "contact", loader: () => redirect("/connect") },
      /** Portfolio piece deep link, e.g. `/work/3` — must stay after static segments. */
      { path: ":categoryFolder/:slug", Component: Works },
    ],
  },
];

/** Vite BASE_URL ends with `/`; React Router basename must not. */
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export const router = createBrowserRouter(routes, {
  basename: base === "" ? "/" : base,
});
