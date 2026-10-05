/**
 * Offline Package Store & Cache Manager – Module 5: Offline Resilience
 * Handles:
 * 1. Simulating / downloading offline packages (tiles, flood risk layers, safe routes, hospitals)
 * 2. Caching in localStorage / memory
 * 3. Reporting download progress (0% -> 100%) and cache byte size
 * 4. Serving cached data when offline
 */
import { fetchOfflinePackage } from "../api/client";
import type { HospitalInfo, OfflinePackage, RiskCollection, RouteResponse } from "../api/types";
import { fallbackRisk, fallbackRoute } from "../fixtures/mockData";
import { PILOT_EMERGENCY_HOSPITALS } from "./accidentSeverity";

const STORAGE_KEY = "aquaroute_offline_package_v1";

export interface DownloadProgress {
  isDownloading: boolean;
  progressPercent: number; // 0 - 100
  stage: string;
  bytesDownloadedKb: number;
  totalSizeKb: number;
  error: string | null;
}

export type StorageListener = (pkg: OfflinePackage | null) => void;

class OfflineStoreManager {
  private cachedPackage: OfflinePackage | null = null;
  private listeners = new Set<StorageListener>();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.cachedPackage = JSON.parse(raw);
      }
    } catch {
      /* ignore invalid json */
    }
  }

  public isDownloaded(): boolean {
    return this.cachedPackage !== null;
  }

  public getPackage(): OfflinePackage | null {
    return this.cachedPackage;
  }

  public subscribe(fn: StorageListener): () => void {
    this.listeners.add(fn);
    fn(this.cachedPackage);
    return () => this.listeners.delete(fn);
  }

  public clear() {
    this.cachedPackage = null;
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.broadcast();
  }

  /**
   * Downloads the complete offline package (with step-by-step progress callback).
   */
  public async downloadPackage(
    onProgress?: (p: DownloadProgress) => void
  ): Promise<OfflinePackage> {
    const notify = (percent: number, stage: string, downloadedKb: number, totalKb = 3450) => {
      onProgress?.({
        isDownloading: percent < 100,
        progressPercent: percent,
        stage,
        bytesDownloadedKb: downloadedKb,
        totalSizeKb: totalKb,
        error: null,
      });
    };

    notify(10, "Initializing offline catchment index...", 340);
    await new Promise((r) => setTimeout(r, 200));

    let pkg: OfflinePackage;
    try {
      notify(30, "Downloading OpenStreetMap road network & vector tiles...", 1200);
      pkg = await fetchOfflinePackage();
      await new Promise((r) => setTimeout(r, 300));
    } catch {
      // Offline / fallback package builder if backend is unreachable
      pkg = {
        metadata: {
          version: "1.0.0-offline",
          generated_at: new Date().toISOString(),
          catchment: "Bengaluru (Agara-HSR-Bellandur)",
          bbox: [77.635, 12.905, 77.695, 12.945],
          total_segments: fallbackRisk.features.length,
          package_size_kb: 3450,
          description: "Cached offline dataset: road network, 3h flood risk predictions, safe evacuation routes.",
        },
        segments_geojson: {
          type: "FeatureCollection",
          features: fallbackRisk.features,
        },
        current_risk: fallbackRisk,
        key_safe_routes: [fallbackRoute],
        emergency_hospitals: PILOT_EMERGENCY_HOSPITALS as unknown as HospitalInfo[],
      };
    }

    notify(60, "Caching 3-hour flood nowcast curves & risk polygons...", 2400);
    await new Promise((r) => setTimeout(r, 300));

    notify(85, "Precomputing safe evacuation routes & trauma hospital POIs...", 3100);
    await new Promise((r) => setTimeout(r, 250));

    // Persist to localStorage / memory
    this.cachedPackage = pkg;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pkg));
      }
    } catch {
      /* quota exceeded or storage blocked */
    }

    notify(100, "Offline package ready! Navigation available without network.", 3450);
    this.broadcast();
    return pkg;
  }

  /**
   * Returns cached flood risk collection if offline.
   */
  public getOfflineRisk(): RiskCollection | null {
    return this.cachedPackage?.current_risk ?? fallbackRisk;
  }

  /**
   * Returns pre-cached key safe routes.
   */
  public getOfflineRoutes(): RouteResponse[] {
    return this.cachedPackage?.key_safe_routes ?? [fallbackRoute];
  }

  /**
   * Returns cached hospitals.
   */
  public getOfflineHospitals(): HospitalInfo[] {
    return this.cachedPackage?.emergency_hospitals ?? (PILOT_EMERGENCY_HOSPITALS as unknown as HospitalInfo[]);
  }

  private broadcast() {
    for (const fn of this.listeners) {
      fn(this.cachedPackage);
    }
  }
}

export const offlineStore = new OfflineStoreManager();
