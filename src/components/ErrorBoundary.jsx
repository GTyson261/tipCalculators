import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Something went wrong.",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Crash caught by ErrorBoundary:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      errorMessage: "",
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.wrap}>
          <div style={styles.card}>
            <h1 style={styles.title}>⚠️ Arcade Crash Protected</h1>
            <p style={styles.text}>
              A component crashed, but the app did not fully break.
            </p>
            <p style={styles.error}>{this.state.errorMessage}</p>

            <div style={styles.buttonRow}>
              <button style={styles.button} onClick={this.handleReset}>
                Try Reset
              </button>
              <button style={styles.button} onClick={this.handleReload}>
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background:
      "radial-gradient(circle at top, rgba(255,77,109,0.18), transparent 30%), linear-gradient(180deg, #050816, #12002e)",
    color: "white",
  },
  card: {
    width: "100%",
    maxWidth: "680px",
    padding: "28px",
    borderRadius: "20px",
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
    textAlign: "center",
  },
  title: {
    margin: "0 0 12px",
    fontSize: "2rem",
  },
  text: {
    margin: "0 0 12px",
    fontSize: "1rem",
    opacity: 0.9,
  },
  error: {
    margin: "0 0 20px",
    padding: "12px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.06)",
    color: "#ffd6de",
    wordBreak: "break-word",
    fontFamily: "monospace",
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  button: {
    padding: "10px 18px",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    background: "linear-gradient(135deg, #ff4d6d, #6a5cff)",
    color: "white",
    fontSize: "15px",
  },
};

export default ErrorBoundary;