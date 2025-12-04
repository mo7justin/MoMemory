"use client";

import axios from "axios";
import { Provider } from "react-redux";
import { store } from "../store/store";
import { LanguageProvider } from "../components/shared/LanguageContext";
import { ThemeProvider } from "../components/theme-provider";

// Ensure all axios requests automatically send cookies/session info
axios.defaults.withCredentials = true;
axios.defaults.headers.common["Accept"] = "application/json";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <LanguageProvider>{children}</LanguageProvider>
      </ThemeProvider>
    </Provider>
  );
}
