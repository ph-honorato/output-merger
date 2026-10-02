import { RouterProvider } from '@tanstack/react-router';
import { router } from './routes/routeTree.gen.tsx';

function App() {
  return (
    <RouterProvider router={router} />
  );
}

export default App;
