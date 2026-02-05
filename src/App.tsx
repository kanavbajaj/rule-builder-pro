import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import RulesList from "./pages/RulesList";
import RuleEditor from "./pages/RuleEditor";
import RuleHistory from "./pages/RuleHistory";
import Simulator from "./pages/Simulator";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/rules" element={<RulesList />} />
          <Route path="/rules/new" element={<RuleEditor />} />
          <Route path="/rules/:id" element={<RuleEditor />} />
          <Route path="/rules/:id/history" element={<RuleHistory />} />
          <Route path="/simulate" element={<Simulator />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
