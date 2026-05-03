import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchResult } from "../shared/searchTypes";
import "./styles.css";

const PAGE_SIZE = 8;

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs, value]);

  return debounced;
}

function resultIconClass(result: SearchResult) {
  return result.name.includes(".") ? "resultIcon fileIcon" : "resultIcon folderIcon";
}

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebouncedValue(query, 120);
  const hasQuery = Boolean(query.trim());
  const visibleResults = results.slice(0, visibleCount);
  const selected = useMemo(() => results[selectedIndex], [results, selectedIndex]);
  const hasMore = visibleCount < results.length;

  useEffect(() => {
    window.everythingSearch.onWindowShown(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  useEffect(() => {
    window.everythingSearch.setExpanded(hasQuery);
  }, [hasQuery]);

  useEffect(() => {
    let active = true;

    async function runSearch() {
      if (!debouncedQuery.trim()) {
        setResults([]);
        setVisibleCount(PAGE_SIZE);
        setSelectedIndex(0);
        setError("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const response = await window.everythingSearch.search(debouncedQuery);
      if (!active) {
        return;
      }
      setResults(response.results);
      setVisibleCount(PAGE_SIZE);
      setSelectedIndex(0);
      setError(response.error ?? "");
      setIsLoading(false);
    }

    runSearch();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const number = Number(event.key);
      if (event.ctrlKey && Number.isInteger(number) && number >= 1 && number <= 8) {
        const result = visibleResults[number - 1];
        if (result) {
          event.preventDefault();
          window.everythingSearch.openPath(result.path);
          window.everythingSearch.hideWindow();
        }
      }
      if (event.ctrlKey && event.key === "9" && hasMore) {
        event.preventDefault();
        loadNextPage();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        window.everythingSearch.hideWindow();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((index) => Math.max(index - 1, 0));
      }
      if (event.key === "Enter" && selected) {
        event.preventDefault();
        if (event.altKey) {
          window.everythingSearch.revealPath(selected.path);
        } else {
          window.everythingSearch.openPath(selected.path);
          window.everythingSearch.hideWindow();
        }
      }
      if (event.key.toLowerCase() === "c" && event.ctrlKey && selected) {
        event.preventDefault();
        window.everythingSearch.copyPath(selected.path);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasMore, results.length, selected, visibleResults]);

  function loadNextPage() {
    setVisibleCount((count) => Math.min(count + PAGE_SIZE, results.length));
  }

  function onResultsScroll(event: React.UIEvent<HTMLDivElement>) {
    const node = event.currentTarget;
    const distanceToBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    if (distanceToBottom < 80) {
      loadNextPage();
    }
  }

  return (
    <main className={hasQuery ? "launcher expanded" : "launcher compact"}>
      <section className="panel">
        <div className="searchLine">
          <input
            ref={inputRef}
            value={query}
            placeholder="搜索文件、文件夹或路径"
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <span className="searchWatermark">⌕</span>
        </div>

        {hasQuery ? (
          <div className="results" role="listbox" aria-label="搜索结果" onScroll={onResultsScroll}>
            {error ? <div className="state">{error}</div> : null}
            {!error && !isLoading && results.length === 0 ? <div className="state">没有结果</div> : null}
            {visibleResults.map((result, index) => (
              <div
                className={index === selectedIndex ? "result selected" : "result"}
                key={result.id}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <div className={resultIconClass(result)} aria-hidden="true" />
                <div className="resultText">
                  <div className="name">{result.name}</div>
                  <div className="path">{result.path}</div>
                </div>
                <div className="shortcut">Ctrl+{index + 1}</div>
              </div>
            ))}
            {hasMore ? (
              <button className="moreResult" type="button" onClick={loadNextPage}>
                <span className="moreIcon">↗</span>
                <span className="moreText">
                  <span className="moreTitle">
                    展示更多 <strong>{query}</strong> 的文件搜索结果
                  </span>
                  <span className="moreHint">热键: Ctrl+9</span>
                </span>
                <span className="shortcut">Ctrl+9</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
