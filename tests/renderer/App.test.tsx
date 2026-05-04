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

describe("App selection interactions", () => {
  it("uses the same selected state for mouse hover and keyboard actions", async () => {
    render(<App />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");

    const options = screen.getAllByRole("option");
    fireEvent.mouseEnter(options[1]);
    expect(options[1]).toHaveClass("selected");
    expect(options[0]).not.toHaveClass("selected");

    fireEvent.keyDown(window, { key: "Enter" });

    expect(api.openPath).toHaveBeenCalledWith("D:\\a.txt");
  });

  it("loads the next page when arrow selection moves beyond visible results", async () => {
    api.search.mockResolvedValue({
      results: Array.from({ length: 13 }, (_, index) => ({
        id: `D:\\${index}.txt`,
        name: `${index}.txt`,
        path: `D:\\${index}.txt`,
        directory: "D:\\"
      }))
    });
    render(<App />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "qq" }
    });

    await screen.findByText("7.txt");
    expect(screen.queryByText("8.txt")).not.toBeInTheDocument();

    for (let index = 0; index < 8; index += 1) {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    }

    expect(await screen.findByText("8.txt")).toBeInTheDocument();
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("8.txt");
  });

  it("scrolls the selected result into view after keyboard movement", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<App />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");

    fireEvent.keyDown(window, { key: "ArrowDown" });

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" }));
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

  it("窗口显示后下一轮仍把焦点放回搜索框并清空旧搜索", async () => {
    const outsideButton = document.createElement("button");
    document.body.appendChild(outsideButton);

    try {
      render(<App />);
      const input = screen.getByRole("textbox");

      fireEvent.change(input, {
        target: { value: "qq" }
      });
      await screen.findByText("QQ");

      act(() => {
        windowShownCallback?.();
      });
      expect(input).toHaveValue("");
      expect(document.activeElement).toBe(input);

      outsideButton.focus();
      expect(document.activeElement).toBe(outsideButton);

      await act(async () => {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 0);
        });
      });
      expect(document.activeElement).toBe(input);
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    } finally {
      outsideButton.remove();
    }
  });

  it("按参考图布局渲染搜索结果", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "qq" }
    });

    await waitFor(() => expect(api.search).toHaveBeenCalledWith("qq"));
    expect(await screen.findByText("QQ")).toHaveClass("name");
    expect(screen.getByText("D:\\QQ")).toHaveClass("path");
    expect(screen.getByText("Alt+1")).toHaveClass("shortcut");
    expect(screen.getByRole("option", { selected: true })).toHaveClass("selected");
    expect(api.setExpanded).toHaveBeenLastCalledWith(true);
  });

  it("renders the real result logo when icon data is available", async () => {
    api.search.mockResolvedValue({
      results: [
        {
          id: "D:\\QQ\\QQ.exe",
          name: "QQ.exe",
          path: "D:\\QQ\\QQ.exe",
          directory: "D:\\QQ",
          kind: "app",
          iconDataUrl: "data:image/png;base64,qq-logo"
        }
      ]
    });
    render(<App />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "qq" }
    });

    const logo = await screen.findByRole("img", { name: "QQ.exe logo" });
    expect(logo).toHaveClass("resultIcon", "realIcon");
    expect(logo).toHaveAttribute("src", "data:image/png;base64,qq-logo");
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

  it("Alt+数字打开对应结果", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("搜索文件、文件夹或路径"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "2", altKey: true });

    expect(api.openPath).toHaveBeenCalledWith("D:\\a.txt");
    expect(api.hideWindow).toHaveBeenCalledOnce();
  });

  it("Ctrl+数字不再打开对应结果", async () => {
    render(<App />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");
    fireEvent.keyDown(window, { key: "2", ctrlKey: true });

    expect(api.openPath).not.toHaveBeenCalled();
    expect(api.hideWindow).not.toHaveBeenCalled();
  });

  it("opens a result with mouse click like pressing Enter", async () => {
    render(<App />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");

    fireEvent.click(screen.getAllByRole("option")[1]);

    expect(api.openPath).toHaveBeenCalledWith("D:\\a.txt");
    expect(api.hideWindow).toHaveBeenCalledOnce();
  });

  it("opens a result location with right click", async () => {
    render(<App />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");

    fireEvent.contextMenu(screen.getAllByRole("option")[1]);

    expect(api.revealPath).toHaveBeenCalledWith("D:\\a.txt");
    expect(api.openPath).not.toHaveBeenCalled();
    expect(api.hideWindow).not.toHaveBeenCalled();
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

  it("pressing ArrowUp on the first result selects the last result", async () => {
    render(<App />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "txt" }
    });
    await screen.findByText("a.txt");

    fireEvent.keyDown(window, { key: "ArrowUp" });
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
