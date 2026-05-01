import { useState } from "react";
import { Sidebar } from "./shared/Sidebar.js";
import { ScratchpadView } from "./scratchpad/ScratchpadView.js";
import { DicomView } from "./dicom/DicomView.js";
import type { WorkflowId } from "./shared/workflows.js";

export function App() {
  const [active, setActive] = useState<WorkflowId>("scratchpad");

  return (
    <div className="app-shell">
      <Sidebar active={active} onSelect={setActive} />
      <main className="app-main">
        {active === "scratchpad" && <ScratchpadView />}
        {active === "dicom" && <DicomView />}
      </main>
    </div>
  );
}
