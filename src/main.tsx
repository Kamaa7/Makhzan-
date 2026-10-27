import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { BootScreen } from "./components/BootScreen";
import { AuthProvider } from "./context/AuthContext";
import { DbProvider } from "./context/DbContext";
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

  render() {
    if (this.state.error) {
      return <BootScreen message="Makhzan failed to start." error={this.state.error.message} />;
    }
    return this.props.children;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <BootErrorBoundary>
      <DbProvider>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </DbProvider>
    </BootErrorBoundary>
  </StrictMode>,
);
