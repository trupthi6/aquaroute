import type { RiskClass } from "../api/types";
import { CLASS_STYLE } from "../lib/risk";

/** Text label + colour. Never colour alone (accessibility rule from the blueprint). */
export default function RiskBadge({ riskClass, prefix }: { riskClass: RiskClass; prefix?: string }) {
  return (
    <span className={`badge badge-${riskClass}`} style={{ background: CLASS_STYLE[riskClass].color }}>
      {prefix ? `${prefix} ` : ""}
      {CLASS_STYLE[riskClass].label}
    </span>
  );
}
