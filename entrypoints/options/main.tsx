import React from "react";
import ReactDOM from "react-dom/client";
import "@/assets/tailwind.css";
import { bootstrapTheme } from "@/lib/theme-dom";
import App from "./App";

// 描画前にテーマを確定させる（settings の読み込みは非同期なので、
// ここで前回値を反映しておかないと一瞬だけ反対のテーマが見えてしまう）
bootstrapTheme();

const root = document.getElementById("root");
if (root === null) throw new Error("#root not found");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
