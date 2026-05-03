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
      { id: "D:\\a.txt", name: "a.txt", path: "D:\\a.txt", directory: "D:\\" },
      { id: "D:\\b.txt", name: "b.txt", path: "D:\\b.txt", directory: "D:\\" }
    ]
  });
});

describe("App", () => {
  it("启动时只显示搜索框", async () => {
    render(<App />);

    await waitFor(() => expect(api.setExpanded).toHaveBeenLastCalledWith(false));

    expect(screen.getByPlaceholderText("搜索文件、文件夹或路径")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByText("输入关键词开始搜索")).not.toBeInTheDocument();
    expect(screen.queryByText("上下键选择 · Enter 打开 · Alt+Enter 定位 · Ctrl+C 复制")).not.toBeInTheDocument();
    expect(api.search).not.toHaveBeenCalled();
  });

  it("输入时搜索并渲染结果", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });

    await waitFor(() => expect(api.search).toHaveBeenCalledWith("txt"));
    expect(await screen.findByText("a.txt")).toBeInTheDocument();
    expect(screen.getByText("D:\\a.txt")).toBeInTheDocument();
    expect(api.setExpanded).toHaveBeenLastCalledWith(true);
  });

  it("按 Enter 打开当前选中结果并隐藏窗口", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "Enter" });

    expect(api.openPath).toHaveBeenCalledWith("D:\\a.txt");
    expect(api.hideWindow).toHaveBeenCalledOnce();
  });

  it("方向键可以移动选中项", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("b.txt");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(api.openPath).toHaveBeenCalledWith("D:\\b.txt");
  });

  it("Alt+Enter 打开选中结果所在位置", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "Enter", altKey: true });

    expect(api.revealPath).toHaveBeenCalledWith("D:\\a.txt");
  });

  it("Ctrl+C 复制选中结果路径", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "c", ctrlKey: true });

    expect(api.copyPath).toHaveBeenCalledWith("D:\\a.txt");
  });

  it("按 Escape 隐藏窗口", async () => {
    render(<App />);
    await waitFor(() => expect(api.setExpanded).toHaveBeenLastCalledWith(false));

    fireEvent.keyDown(window, { key: "Escape" });

    expect(api.hideWindow).toHaveBeenCalledOnce();
  });

  it("滚动到底部时加载下一页结果", async () => {
    api.search.mockResolvedValue({
      results: Array.from({ length: 25 }, (_, index) => ({
        id: `D:\\${index}.txt`,
        name: `${index}.txt`,
        path: `D:\\${index}.txt`,
        directory: "D:\\"
      }))
    });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });

    expect(await screen.findByText("0.txt")).toBeInTheDocument();
    expect(screen.queryByText("20.txt")).not.toBeInTheDocument();

    const list = screen.getByRole("listbox");
    Object.defineProperty(list, "scrollTop", { value: 500, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 200, configurable: true });
    Object.defineProperty(list, "scrollHeight", { value: 650, configurable: true });
    fireEvent.scroll(list);

    expect(await screen.findByText("20.txt")).toBeInTheDocument();
  });
});
