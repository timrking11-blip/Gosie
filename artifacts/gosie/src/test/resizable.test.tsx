import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

afterEach(cleanup);

describe("resizable wrapper compatibility with the locked v2 dependency", () => {
  it.each(["horizontal", "vertical"] as const)(
    "renders real %s panels with an accessible, focusable handle",
    (direction) => {
      const { container } = render(
        <ResizablePanelGroup direction={direction}>
          <ResizablePanel id="first-panel" defaultSize={50} minSize={20}>
            First panel
          </ResizablePanel>
          <ResizableHandle withHandle aria-label="Resize panels" />
          <ResizablePanel id="second-panel" defaultSize={50} minSize={20}>
            Second panel
          </ResizablePanel>
        </ResizablePanelGroup>,
      );

      expect(screen.getByText("First panel")).toBeVisible();
      expect(screen.getByText("Second panel")).toBeVisible();
      const handle = screen.getByRole("separator", { name: "Resize panels" });
      expect(handle).toHaveAttribute("data-panel-group-direction", direction);
      expect(handle).toHaveAttribute("tabindex", "0");
      expect(handle.querySelector("svg")).not.toBeNull();
      expect(container.querySelectorAll("[data-panel]")).toHaveLength(2);
      act(() => handle.focus());
      expect(handle).toHaveFocus();
    },
  );
});
