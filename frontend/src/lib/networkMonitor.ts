/**
 * Network Monitoring Agent – Module 5: Offline Resilience
 * Continuously monitors:
 * 1. Signal strength (0 - 100%)
 * 2. Network availability (online / offline)
 * 3. Connectivity quality (good / weak / offline)
 *
 * When network quality drops below threshold (e.g. into 'weak'):
 * Triggers notification: "Weak connectivity detected. Download offline flood maps and safe routes?"
 */
import type { NetworkQuality } from "../api/types";

export interface NetworkState {
  online: boolean;
  quality: NetworkQuality;
  signalStrengthPercent: number; // 0 - 100
  effectiveType: string;         // '4g' | '3g' | '2g' | 'slow-2g'
  rttMs: number;
  downlinkMbps: number;
  isSimulated: boolean;
  promptWeakConnectivity: boolean;
}

export type NetworkListener = (state: NetworkState) => void;

class NetworkMonitorAgent {
  private listeners = new Set<NetworkListener>();
  private state: NetworkState;
  private intervalId: any = null;
  private simulatedQuality: NetworkQuality | null = null;
  private hasPromptedWeakDownload = false;

  constructor() {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    this.state = {
      online: isOnline,
      quality: isOnline ? "good" : "offline",
      signalStrengthPercent: isOnline ? 92 : 0,
      effectiveType: "4g",
      rttMs: 45,
      downlinkMbps: 12.5,
      isSimulated: false,
      promptWeakConnectivity: false,
    };
  }

  public start(pollIntervalMs = 5000) {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleBrowserOnlineChange(true));
      window.addEventListener("offline", () => this.handleBrowserOnlineChange(false));

      // Network Information API if available
      const conn = (navigator as any).connection;
      if (conn) {
        conn.addEventListener("change", () => this.evaluateQuality());
      }
    }

    this.evaluateQuality();
    if (!this.intervalId) {
      this.intervalId = setInterval(() => this.evaluateQuality(), pollIntervalMs);
    }
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public subscribe(fn: NetworkListener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  public getState(): NetworkState {
    return this.state;
  }

  public simulateQuality(quality: NetworkQuality | "auto") {
    if (quality === "auto") {
      this.simulatedQuality = null;
    } else {
      this.simulatedQuality = quality;
    }
    this.hasPromptedWeakDownload = false; // Reset prompt so user can trigger it again
    this.evaluateQuality();
  }

  public dismissWeakPrompt() {
    this.state = {
      ...this.state,
      promptWeakConnectivity: false,
    };
    this.broadcast();
  }

  private handleBrowserOnlineChange(online: boolean) {
    if (this.simulatedQuality === null) {
      this.state.online = online;
      this.evaluateQuality();
    }
  }

  private evaluateQuality() {
    let quality: NetworkQuality = "good";
    let signalStrength = 92;
    let rtt = 45;
    let downlink = 10.0;
    let effectiveType = "4g";
    let isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    if (this.simulatedQuality !== null) {
      quality = this.simulatedQuality;
      if (quality === "good") {
        isOnline = true;
        signalStrength = 95;
        rtt = 42;
        downlink = 15.2;
        effectiveType = "4g";
      } else if (quality === "weak") {
        isOnline = true;
        signalStrength = 24; // Below threshold (< 30%)
        rtt = 680;
        downlink = 0.25;
        effectiveType = "2g";
      } else {
        isOnline = false;
        signalStrength = 0;
        rtt = 0;
        downlink = 0;
        effectiveType = "none";
      }
    } else {
      // Real browser network heuristics
      if (!isOnline) {
        quality = "offline";
        signalStrength = 0;
      } else {
        const conn = (navigator as any).connection;
        if (conn) {
          effectiveType = conn.effectiveType ?? "4g";
          rtt = conn.rtt ?? 50;
          downlink = conn.downlink ?? 10.0;

          if (effectiveType === "slow-2g" || effectiveType === "2g" || rtt > 600 || downlink < 0.5) {
            quality = "weak";
            signalStrength = 22;
          } else if (effectiveType === "3g" || rtt > 300) {
            quality = "weak";
            signalStrength = 48;
          } else {
            quality = "good";
            signalStrength = 88;
          }
        } else {
          quality = "good";
          signalStrength = 85;
        }
      }
    }

    const enteredWeakState = quality === "weak" && !this.hasPromptedWeakDownload;
    if (enteredWeakState) {
      this.hasPromptedWeakDownload = true;
    }

    this.state = {
      online: isOnline,
      quality,
      signalStrengthPercent: signalStrength,
      effectiveType,
      rttMs: rtt,
      downlinkMbps: downlink,
      isSimulated: this.simulatedQuality !== null,
      promptWeakConnectivity: enteredWeakState || (quality === "weak" && this.state.promptWeakConnectivity),
    };

    this.broadcast();
  }

  private broadcast() {
    for (const fn of this.listeners) {
      fn(this.state);
    }
  }
}

export const networkMonitor = new NetworkMonitorAgent();
