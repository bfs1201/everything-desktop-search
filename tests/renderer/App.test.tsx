import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/renderer/App";

const api = {
  search: vi.fn(),
  openPath: vi.fn(),
  revealPath: vi.fn(),
  copyPath: vi.fn(),
  onWindowShown: vi.fn()
};

beforeEach(() => {
  vi.clearAllMocks();
  window.everythingSearch = api;
  api.search.mockResolvedValue({
    results: [
      { id: "D:\\a.txt", name: "a.txt", path: "D:\\a.txt", directory: "D:\\" },
      { id: "D:\\b.txt", name: "b.txt", path: "D:\\b.txt", directory: "D:\\" }
    ]
  });
});

describe("App", () => {
  it("searches and renders results as the user types", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });

    await waitFor(() => expect(api.search).toHaveBeenCalledWith("txt"));
    expect(await screen.findByText("a.txt")).toBeInTheDocument();
    expect(screen.getByText("D:\\a.txt")).toBeInTheDocument();
  });

  it("opens the selected result with Enter", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "Enter" });

    expect(api.openPath).toHaveBeenCalledWith("D:\\a.txt");
  });

  it("moves selection with arrow keys", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("b.txt");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(api.openPath).toHaveBeenCalledWith("D:\\b.txt");
  });

  it("reveals the selected result with Alt+Enter", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "Enter", altKey: true });

    expect(api.revealPath).toHaveBeenCalledWith("D:\\a.txt");
  });

  it("copies the selected path with Ctrl+C", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "c", ctrlKey: true });

    expect(api.copyPath).toHaveBeenCalledWith("D:\\a.txt");
  });
});
