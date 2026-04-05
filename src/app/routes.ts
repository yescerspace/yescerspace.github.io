import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Works } from "./pages/Works";
import { About } from "./pages/About";
import { Contact } from "./pages/Contact";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: Layout,
      children: [
        { index: true, Component: Works },
        { path: "about", Component: About },
        { path: "contact", Component: Contact },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
