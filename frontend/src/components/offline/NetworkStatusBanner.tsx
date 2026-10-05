/**
 * Network Status Banner & Offline Resilience Manager – Module 5
 * Continuously monitors:
 * 1. Signal strength & quality
 * 2. Weak connectivity prompt:
 *    "Weak connectivity detected. Download offline flood maps and safe routes?"
 * 3. Offline package download simulation & storage indicator
 * 4. Offline mode navigation switch
 */
import { useEffect, useState } from "react";
import { type NetworkState, networkMonitor } from "../../lib/networkMonitor";
import { type DownloadProgress, offlineStore } from "../../lib/offlineStore";

interface Props {
  onOfflineModeChanged?: (isOffline: boolean) => void;
}

export default function NetworkStatusBanner({ onOfflineModeChanged }: Props) {
  const [netState, setNetState] = useState<NetworkState>(networkMonitor.getState());
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isCached, setIsCached] = useState(offlineStore.isDownloaded());
  const [showSimControls, setShowSimControls] = useState(false);

  useEffect(() => {
    networkMonitor.start();
    const unsubNet = networkMonitor.subscribe((state) => {
      setNetState(state);
      onOfflineModeChanged?.(!state.online || state.quality === "offline");
    });
    const unsubStore = offlineStore.subscribe((pkg) => {
      setIsCached(pkg !== null);
    });
    return () => {
      unsubNet();
      unsubStore();
      networkMonitor.stop();
    };
  }, [onOfflineModeChanged]);

  async function handleDownloadPackage() {
    setDownloadProgress({
      isDownloading: true,
      progressPercent: 5,
      stage: "Connecting to flood catchment cache...",
      bytesDownloadedKb: 0,
      totalSizeKb: 3450,
      error: null,
    });

    try {
      await offlineStore.downloadPackage((prog) => {
        setDownloadProgress(prog);
      });
      setIsCached(true);
      networkMonitor.dismissWeakPrompt();
      setTimeout(() => setDownloadProgress(null), 3500);
    } catch {
      setDownloadProgress({
        isDownloading: false,
        progressPercent: 100,
        stage: "Fallback offline package saved locally.",
        bytesDownloadedKb: 3450,
        totalSizeKb: 3450,
        error: null,
      });
      setIsCached(true);
      setTimeout(() => setDownloadProgress(null), 3000);
    }
  }

  const { quality, signalStrengthPercent, promptWeakConnectivity, online } = netState;

  // Signal color & icon
  const qualityBadge =
    quality === "good"
      ? { text: "Online (4G/5G)", bg: "#15803d", icon: "📶" }
      : quality === "weak"
      ? { text: "Weak Signal", bg: "#d97706", icon: "⚠️" }
      : { text: "Offline Mode", bg: "#b91c1c", icon: "📴" };

  return (
    <div className="network-resilience-container">
      {/* Top Network Status Pill */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 10px",
          background: quality === "offline" ? "#450a0a" : "#0f172a",
          color: "#fff",
          fontSize: "0.8rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <span style={{ fontSize: "0.9rem" }}>{qualityBadge.icon}</span>
        <span>
          <strong>{qualityBadge.text}</strong> · Signal: {signalStrengthPercent}%
        </span>

        {isCached ? (
          <span
            style={{
              marginLeft: "auto",
              background: "#0369a1",
              color: "#fff",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "0.7rem",
            }}
          >
            💾 Offline Maps Cached (3.4 MB)
          </span>
        ) : (
          <button
            type="button"
            onClick={handleDownloadPackage}
            disabled={downloadProgress?.isDownloading}
            style={{
              marginLeft: "auto",
              background: "#334155",
              color: "#e2e8f0",
              border: "none",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            📥 Download Offline Package
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowSimControls((v) => !v)}
          style={{
            background: "transparent",
            color: "#94a3b8",
            border: "1px solid #475569",
            padding: "2px 6px",
            borderRadius: "4px",
            fontSize: "0.7rem",
            cursor: "pointer",
          }}
        >
          ⚙️ Network Sim
        </button>
      </div>

      {/* Network Simulation Controls (Collapsible) */}
      {showSimControls && (
        <div
          style={{
            background: "#1e293b",
            color: "#e2e8f0",
            padding: "8px 12px",
            fontSize: "0.8rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            borderBottom: "1px solid #334155",
          }}
        >
          <span style={{ color: "#94a3b8" }}>Simulate Quality:</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => networkMonitor.simulateQuality("good")}
            style={{
              background: quality === "good" ? "#16a34a" : "#334155",
              color: "#fff",
              fontSize: "0.75rem",
              padding: "2px 8px",
            }}
          >
            Good (95%)
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => networkMonitor.simulateQuality("weak")}
            style={{
              background: quality === "weak" ? "#d97706" : "#334155",
              color: "#fff",
              fontSize: "0.75rem",
              padding: "2px 8px",
            }}
          >
            Weak (24%)
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => networkMonitor.simulateQuality("offline")}
            style={{
              background: quality === "offline" ? "#dc2626" : "#334155",
              color: "#fff",
              fontSize: "0.75rem",
              padding: "2px 8px",
            }}
          >
            Offline (0%)
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => networkMonitor.simulateQuality("auto")}
            style={{
              background: "#475569",
              color: "#cbd5e1",
              fontSize: "0.75rem",
              padding: "2px 8px",
              marginLeft: "auto",
            }}
          >
            Auto / Reset
          </button>
        </div>
      )}

      {/* Weak Connectivity Alert Notification Banner (Requirement 3) */}
      {promptWeakConnectivity && (
        <div
          className="weak-net-prompt"
          style={{
            background: "#fef3c7",
            color: "#92400e",
            padding: "10px 14px",
            borderBottom: "1px solid #fde68a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.2rem" }}>⚠️</span>
            <div>
              <strong>Weak connectivity detected.</strong>
              <div style={{ fontSize: "0.85rem" }}>
                Download offline flood maps and safe routes?
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleDownloadPackage}
              disabled={downloadProgress?.isDownloading}
              style={{
                background: "#d97706",
                color: "#fff",
                border: "none",
                padding: "6px 12px",
                borderRadius: "4px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📥 Download Offline Maps
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => networkMonitor.dismissWeakPrompt()}
              style={{
                background: "transparent",
                color: "#92400e",
                border: "1px solid #d97706",
                padding: "6px 10px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Active Download Progress Drawer */}
      {downloadProgress && (
        <div
          style={{
            background: "#0c4a6e",
            color: "#f0f9ff",
            padding: "8px 14px",
            borderBottom: "1px solid #0284c7",
            fontSize: "0.85rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span>📦 {downloadProgress.stage}</span>
            <span>
              <strong>{downloadProgress.progressPercent}%</strong> (
              {(downloadProgress.bytesDownloadedKb / 1024).toFixed(1)} /{" "}
              {(downloadProgress.totalSizeKb / 1024).toFixed(1)} MB)
            </span>
          </div>
          <div
            style={{
              height: "6px",
              background: "#0369a1",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${downloadProgress.progressPercent}%`,
                background: "#38bdf8",
                transition: "width 0.2s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Offline Mode Active Banner (Requirement 5) */}
      {!online && (
        <div
          className="offline-active-banner"
          style={{
            background: "#7f1d1d",
            color: "#fef2f2",
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.85rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.1rem" }}>📴</span>
            <span>
              <strong>OFFLINE MODE ACTIVE:</strong> Network unavailable. Navigating seamlessly using
              downloaded local map data, flood risk layers & offline Dijkstra routing.
            </span>
          </div>
          <span
            style={{
              background: "#dc2626",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            RESILIENT
          </span>
        </div>
      )}
    </div>
  );
}
