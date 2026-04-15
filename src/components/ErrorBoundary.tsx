import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong. Please try again later.";
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.operationType) {
            isFirestoreError = true;
            errorMessage = `Database error: ${parsed.error}. This usually happens if your domain is not authorized in Firebase or if there are permission issues.`;
          }
        }
      } catch (e) {
        // Not a JSON error, use default or raw message
        if (this.state.error?.message) {
          errorMessage = this.state.error.message;
        }
      }

      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-black border-4 border-red-500 p-8 brutal-shadow relative overflow-hidden">
            {/* Subtle grid background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-red-500 flex items-center justify-center mb-6 brutal-shadow">
                <AlertTriangle className="w-12 h-12 text-black" />
              </div>
              
              <h1 className="text-3xl font-display uppercase tracking-widest text-white mb-4 glitch-text" data-text="System Error">
                System Error
              </h1>
              
              <div className="bg-white/5 border-2 border-white/10 p-4 mb-8 w-full">
                <p className="text-sm font-mono text-text-muted uppercase tracking-widest leading-relaxed">
                  {errorMessage}
                </p>
                {isFirestoreError && (
                  <p className="text-[10px] font-mono text-primary mt-4 uppercase tracking-widest">
                    Tip: Ensure your domain is added to 'Authorized Domains' in Firebase Console.
                  </p>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button
                  onClick={this.handleReset}
                  className="flex-1 px-6 py-3 bg-primary text-black font-display uppercase tracking-widest hover:bg-white transition-colors flex items-center justify-center gap-2 brutal-shadow-hover"
                >
                  <RefreshCw className="w-5 h-5" />
                  Retry
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 px-6 py-3 bg-black text-white border-4 border-white/20 font-display uppercase tracking-widest hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 brutal-shadow-hover"
                >
                  <Home className="w-5 h-5" />
                  Home
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

