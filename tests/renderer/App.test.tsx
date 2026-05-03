import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

let windowShownCallback: (() => void) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  windowShownCallback = undefined;
  window.everythingSearch = api;
  api.onWindowShown.mockImplementation((callback: () => void) => {
    windowShownCallback = callback;
  });
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

  it("每次呼出窗口都会清空上一次搜索", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "qq" }
    });
    await screen.findByText("QQ");

    act(() => {
      windowShownCallback?.();
    });

    await waitFor(() => expect(screen.getByPlaceholderText("搜索文件、文件夹或路径")).toHaveValue(""));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(api.setExpanded).toHaveBeenLastCalledWith(false);
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

  it("渲染搜索结果自带的真实图标", async () => {
    api.search.mockResolvedValue({
      results: [
        {
          id: "D:\\Weixin\\Weixin.exe",
          name: "Weixin.exe",
          path: "D:\\Weixin\\Weixin.exe",
          directory: "D:\\Weixin",
          iconDataUrl: "data:image/png;base64,abc"
        }
      ]
    });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "weixin" }
    });

    expect(await screen.findByAltText("Weixin.exe 图标")).toHaveAttribute("src", "data:image/png;base64,abc");
  });

  it("文件夹结果固定渲染文件夹图标", async () => {
    api.search.mockResolvedValue({
      results: [
        {
          id: "D:\\QQ",
          name: "QQ",
          path: "D:\\QQ",
          directory: "D:\\",
          kind: "folder",
          iconDataUrl: "data:image/png;base64,wrong"
        }
      ]
    });
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "qq" }
    });

    expect(await screen.findByText("QQ")).toBeInTheDocument();
    expect(screen.queryByAltText("QQ 图标")).not.toBeInTheDocument();
    expect(document.querySelector(".folderIcon")).toBeInTheDocument();
  });

  it("点击结果项会直接打开目标并隐藏窗口", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.click(screen.getByText("a.txt").closest('[role="option"]')!);

    expect(api.openPath).toHaveBeenCalledWith("D:\\a.txt");
    expect(api.hideWindow).toHaveBeenCalledOnce();
  });

  it("鼠标悬停结果时同步高亮和实际选中项", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.mouseEnter(screen.getByText("a.txt").closest('[role="option"]')!);
    fireEvent.keyDown(window, { key: "Enter" });

    expect(api.openPath).toHaveBeenCalledWith("D:\\a.txt");
  });

  it("Alt+Enter 打开选中结果所在位置", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("QQ");
    await waitFor(() => expect(screen.getByRole("option", { selected: true })).toHaveTextContent("QQ"));
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

  it("方向键选中分页外结果时扩展列表并滚动到选中项", async () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
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
    await screen.findByText("0.txt");
    for (let index = 0; index < 8; index += 1) {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    }

    expect(await screen.findByText("8.txt")).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });
});
