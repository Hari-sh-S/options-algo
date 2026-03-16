import { Route, Switch } from "wouter";
import Dashboard from "./pages/Dashboard";
import DhanCallbackPage from "./pages/DhanCallbackPage";
import { useEffect } from "react";

function App() {
  useEffect(() => {
    // Add dark mode class globally like Next.js layout did
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/auth/dhan/callback" component={DhanCallbackPage} />
      <Route>
        {/* 404 Fallback */}
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a14] text-white">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">404</h1>
            <p className="text-slate-400 mb-6">Page not found</p>
            <a href="/" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
              Return Home
            </a>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

export default App;
