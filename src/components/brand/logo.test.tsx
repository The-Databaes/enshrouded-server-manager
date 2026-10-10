import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Logo, LogoMark } from "./logo";

describe("LogoMark", () => {
  it("renders an accessible svg", () => {
    render(<LogoMark />);
    expect(
      screen.getByRole("img", { name: /enshrouded server manager/i }),
    ).toBeInTheDocument();
  });
});

describe("Logo", () => {
  it("shows the wordmark by default", () => {
    render(<Logo />);
    expect(screen.getByText("ENSHROUDED")).toBeInTheDocument();
    expect(screen.getByText("Server Manager")).toBeInTheDocument();
  });

  it("hides the wordmark when compact", () => {
    render(<Logo compact />);
    expect(screen.queryByText("ENSHROUDED")).not.toBeInTheDocument();
  });
});
