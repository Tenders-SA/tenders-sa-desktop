import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { markAppStart } from "./lib/performance";
import "./styles/theme.css";

markAppStart();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
