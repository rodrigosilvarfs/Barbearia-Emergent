import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import BarberPanel from "@/pages/BarberPanel";
import AdminPanel from "@/pages/AdminPanel";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/barbeiro" element={<BarberPanel />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <Toaster richColors theme="dark" />
    </>
  );
}
