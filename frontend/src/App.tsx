import { BrowserRouter, Routes, Route } from "react-router-dom";
import LeadsPage from "./pages/LeadsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LeadsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;