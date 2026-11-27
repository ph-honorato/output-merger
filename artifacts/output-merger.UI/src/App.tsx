import { RouterProvider } from "@tanstack/react-router";
import { router } from "./routes/routeTree.gen.tsx";
import { Analytics } from "@vercel/analytics/react";

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Analytics />
    </>
  );
}

export default App;
