import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { isDesktop } from "./lib/desktop";
import { App } from "./App";
import { BootScreen } from "./components/BootScreen";
import { AuthProvider } from "./context/AuthContext";
import { DbProvider } from "./context/DbContext";
import { LanguageProvider } from "./context/LanguageContext";
import { ToastProvider } from "./context/ToastContext";
import "./index.css";

class BootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  componentDidMount() {
    if (import.meta.hot) {
      import.meta.hot.on("vite:afterUpdate", () => {
        this.setState({ error: null });
      });
    }
  }

  render() {
    if (this.state.error) {
      return <BootScreen message="Makhzan failed to start." error={this.state.error.message} />;
    }
    return this.props.children;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

const Router = isDesktop() ? HashRouter : BrowserRouter;

createRoot(root).render(
  <StrictMode>
    <BootErrorBoundary>
      <DbProvider>
        <Router>
          <AuthProvider>
            <LanguageProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </LanguageProvider>
          </AuthProvider>
        </Router>
      </DbProvider>
    </BootErrorBoundary>
  </StrictMode>,
);
