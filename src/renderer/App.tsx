import { useEffect, useRef, useState } from "react";
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

function openResult(result: SearchResult) {
  window.everythingSearch.openPath(result.path);
  window.everythingSearch.hideWindow();
}

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLDivElement | null>>([]);
  const selectedIndexRef = useRef(0);
  const resultsRef = useRef<SearchResult[]>([]);
  const debouncedQuery = useDebouncedValue(query, 120);
  const hasQuery = Boolean(query.trim());
  const visibleResults = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  function selectIndex(index: number) {
    selectedIndexRef.current = index;
    setSelectedIndex(index);
  }

  useEffect(() => {
    window.everythingSearch.onWindowShown(() => {
      setQuery("");
      setResults([]);
      resultsRef.current = [];
      setVisibleCount(PAGE_SIZE);
      selectIndex(0);
      setError("");
      setIsLoading(false);
      inputRef.current?.focus();
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
        resultsRef.current = [];
        setVisibleCount(PAGE_SIZE);
        selectIndex(0);
        setError("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const response = await window.everythingSearch.search(debouncedQuery);
      if (!active) {
        return;
      }
      resultsRef.current = response.results;
      setResults(response.results);
      setVisibleCount(PAGE_SIZE);
      selectIndex(0);
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
        const result = resultsRef.current[number - 1];
        if (result) {
          event.preventDefault();
          openResult(result);
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
        const nextIndex = Math.min(selectedIndexRef.current + 1, Math.max(resultsRef.current.length - 1, 0));
        setVisibleCount((count) => Math.max(count, Math.min(nextIndex + 1, resultsRef.current.length)));
        selectIndex(nextIndex);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectIndex(Math.max(selectedIndexRef.current - 1, 0));
      }
      const activeSelected = resultsRef.current[selectedIndexRef.current];
      if (event.key === "Enter" && activeSelected) {
        event.preventDefault();
        if (event.altKey) {
          window.everythingSearch.revealPath(activeSelected.path);
        } else {
          openResult(activeSelected);
        }
      }
      if (event.key.toLowerCase() === "c" && event.ctrlKey && activeSelected) {
        event.preventDefault();
        window.everythingSearch.copyPath(activeSelected.path);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasMore, results, visibleResults]);

  useEffect(() => {
    resultRefs.current[selectedIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex, visibleCount]);

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
                ref={(node) => {
                  resultRefs.current[index] = node;
                }}
                role="option"
                aria-selected={index === selectedIndex}
                onMouseEnter={() => selectIndex(index)}
                onClick={() => openResult(result)}
              >
                {result.iconDataUrl ? (
                  <img className="resultIcon realIcon" src={result.iconDataUrl} alt={`${result.name} 图标`} />
                ) : (
                  <div className={resultIconClass(result)} aria-hidden="true" />
                )}
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
