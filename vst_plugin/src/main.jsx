/**
 * Main React Application Entry Point
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Error boundary for the entire app
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#18181b',
          color: '#fff',
          padding: '20px'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#a1a1aa', marginBottom: '16px' }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Mount the application
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);