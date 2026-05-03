import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/renderer/App";

const api = {
  search: vi.fn(),
  openPath: vi.fn(),
  revealPath: vi.fn(),
  copyPath: vi.fn(),
  hideWindow: vi.fn(),
  setExpanded: vi.fn(),
  onWindowShown: vi.fn()
};

beforeEach(() => {
  vi.clearAllMocks();
  window.everythingSearch = api;
  api.search.mockResolvedValue({
    results: [
      { id: "D:\\QQ", name: "QQ", path: "D:\\QQ", directory: "D:\\" },
      { id: "D:\\a.txt", name: "a.txt", path: "D:\\a.txt", directory: "D:\\" }
    ]
  });
});

describe("App", () => {
  it("启动时只显示搜索框", async () => {
    render(<App />);

    await waitFor(() => expect(api.setExpanded).toHaveBeenLastCalledWith(false));

    expect(screen.getByPlaceholderText("搜索文件、文件夹或路径")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(api.search).not.toHaveBeenCalled();
  });

  it("按参考图布局渲染搜索结果", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "qq" }
    });

    await waitFor(() => expect(api.search).toHaveBeenCalledWith("qq"));
    expect(await screen.findByText("QQ")).toHaveClass("name");
    expect(screen.getByText("D:\\QQ")).toHaveClass("path");
    expect(screen.getByText("Ctrl+1")).toHaveClass("shortcut");
    expect(screen.getByRole("option", { selected: true })).toHaveClass("selected");
    expect(api.setExpanded).toHaveBeenLastCalledWith(true);
  });

  it("按 Enter 打开当前选中结果并隐藏窗口", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("QQ");
    fireEvent.keyDown(window, { key: "Enter" });

    expect(api.openPath).toHaveBeenCalledWith("D:\\QQ");
    expect(api.hideWindow).toHaveBeenCalledOnce();
  });

  it("Ctrl+数字打开对应结果", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "2", ctrlKey: true });

    expect(api.openPath).toHaveBeenCalledWith("D:\\a.txt");
    expect(api.hideWindow).toHaveBeenCalledOnce();
  });

  it("方向键可以移动选中项", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(api.openPath).toHaveBeenCalledWith("D:\\a.txt");
  });

  it("Alt+Enter 打开选中结果所在位置", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("QQ");
    fireEvent.keyDown(window, { key: "Enter", altKey: true });

    expect(api.revealPath).toHaveBeenCalledWith("D:\\QQ");
  });

  it("Ctrl+C 复制选中结果路径", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("QQ");
    fireEvent.keyDown(window, { key: "c", ctrlKey: true });

    expect(api.copyPath).toHaveBeenCalledWith("D:\\QQ");
  });

  it("按 Escape 隐藏窗口", async () => {
    render(<App />);
    await waitFor(() => expect(api.setExpanded).toHaveBeenLastCalledWith(false));

    fireEvent.keyDown(window, { key: "Escape" });

    expect(api.hideWindow).toHaveBeenCalledOnce();
  });

  it("滚动到底部时加载下一页结果，并显示展示更多行", async () => {
    api.search.mockResolvedValue({
      results: Array.from({ length: 13 }, (_, index) => ({
        id: `D:\\${index}.txt`,
        name: `${index}.txt`,
        path: `D:\\${index}.txt`,
        directory: "D:\\"
      }))
    });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "qq" }
    });

    expect(await screen.findByText("0.txt")).toBeInTheDocument();
    expect(screen.queryByText("8.txt")).not.toBeInTheDocument();
    expect(screen.getByText(/展示更多/)).toBeInTheDocument();
    expect(screen.getByText("qq")).toBeInTheDocument();

    const list = screen.getByRole("listbox");
    Object.defineProperty(list, "scrollTop", { value: 500, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 200, configurable: true });
    Object.defineProperty(list, "scrollHeight", { value: 650, configurable: true });
    fireEvent.scroll(list);

    expect(await screen.findByText("8.txt")).toBeInTheDocument();
  });
});
