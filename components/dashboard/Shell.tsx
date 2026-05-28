import { ReactNode } from "react";
import TopRail from "./TopRail";
import CaptureBox from "./CaptureBox";

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--ink-0)]">
      <TopRail />
      <main className="flex-1 p-4 md:p-6 pb-6">{children}</main>
      <CaptureBox />
    </div>
  );
}
