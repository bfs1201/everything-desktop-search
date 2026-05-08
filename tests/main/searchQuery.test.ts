import { describe, expect, it } from "vitest";
import {
  buildChineseAppCandidateArgs,
  buildChineseCandidateArgs,
  buildEverythingArgs,
  buildEverythingMoreArgs,
  buildEverythingSearches,
  expandSearchTerm,
  isApplicationPinyinCandidateQuery,
  isPinyinCandidateQuery,
  parseSearchQuery
} from "../../src/main/searchQuery";

describe("parseSearchQuery", () => {
  it("parses folder filter", () => {
    expect(parseSearchQuery("folder: qq")).toMatchObject({
      filter: "folder",
      keywords: ["qq"],
      pathTerms: []
    });
  });

  it("parses file filter", () => {
    expect(parseSearchQuery("file: qq")).toMatchObject({
      filter: "file",
      keywords: ["qq"]
    });
  });

  it("parses document filter", () => {
    expect(parseSearchQuery("doc: 毕业")).toMatchObject({
      filter: "doc",
      keywords: ["毕业"]
    });
  });

  it("parses app, recent, path, parent, and excluded terms", () => {
    expect(parseSearchQuery("app: qq !backup")).toMatchObject({
      mode: "apps",
      includeTerms: ["qq"],
      excludeTerms: ["backup"]
    });
    expect(parseSearchQuery("recent: code")).toMatchObject({
      mode: "recent",
      includeTerms: ["code"]
    });
    expect(parseSearchQuery("path:D:\\Downloads qq")).toMatchObject({
      mode: "files",
      pathScope: "D:\\Downloads",
      includeTerms: ["qq"]
    });
    expect(parseSearchQuery("parent:D:\\Downloads qq")).toMatchObject({
      mode: "files",
      parentScope: "D:\\Downloads",
      includeTerms: ["qq"]
    });
  });

  it("recognizes path terms containing backslash or drive prefix", () => {
    expect(parseSearchQuery("desktop\\毕业 d:\\")).toMatchObject({
      keywords: ["毕业"],
      pathTerms: ["desktop\\", "d:\\"]
    });
  });
});

describe("buildEverythingSearches", () => {
  it("builds app candidate and broad searches for default launcher queries", () => {
    expect(buildEverythingSearches(parseSearchQuery("qq"), 200)).toEqual([
      [
        "-n",
        "40",
        "-json",
        "-attributes",
        "-size",
        "-dm",
        "-run-count",
        "-date-run",
        "ext:exe;lnk",
        "qq"
      ],
      [
        "-n",
        "60",
        "-offset",
        "0",
        "-json",
        "-attributes",
        "-size",
        "-dm",
        "-run-count",
        "-date-run",
        "qq"
      ]
    ]);
  });

  it("builds a default next-page search with offset and without app candidates", () => {
    expect(buildEverythingMoreArgs(parseSearchQuery("qq"), 60)).toEqual([
      "-n",
      "60",
      "-offset",
      "60",
      "-json",
      "-attributes",
      "-size",
      "-dm",
      "-run-count",
      "-date-run",
      "qq"
    ]);
  });

  it("does not build ES pagination for non-default searches", () => {
    expect(buildEverythingMoreArgs(parseSearchQuery("file: qq"), 60)).toBeUndefined();
    expect(buildEverythingMoreArgs(parseSearchQuery("app: qq"), 60)).toBeUndefined();
    expect(buildEverythingMoreArgs(parseSearchQuery("recent: qq"), 60)).toBeUndefined();
  });

  it("keeps explicit file filters out of app candidate searches", () => {
    expect(buildEverythingSearches(parseSearchQuery("file: qq"), 200)).toEqual([
      [
        "-n",
        "200",
        "-json",
        "-attributes",
        "-size",
        "-dm",
        "-run-count",
        "-date-run",
        "/a-d",
        "qq"
      ]
    ]);
  });

  it("uses native ES path and parent scopes", () => {
    expect(buildEverythingSearches(parseSearchQuery("path:D:\\Downloads qq"), 200)[0]).toContain("-path");
    expect(buildEverythingSearches(parseSearchQuery("path:D:\\Downloads qq"), 200)[0]).toContain("D:\\Downloads");
    expect(buildEverythingSearches(parseSearchQuery("parent:D:\\Downloads qq"), 200)[0]).toContain("-parent");
    expect(buildEverythingSearches(parseSearchQuery("parent:D:\\Downloads qq"), 200)[0]).toContain("D:\\Downloads");
  });

  it("passes excluded terms and Everything OR groups through to ES", () => {
    expect(buildEverythingSearches(parseSearchQuery("<qq|wechat> !backup"), 200)[1]).toEqual([
      "-n",
      "60",
      "-offset",
      "0",
      "-json",
      "-attributes",
      "-size",
      "-dm",
      "-run-count",
      "-date-run",
      "<qq|wechat>",
      "!backup"
    ]);
  });
});

describe("buildEverythingArgs", () => {
  it("adds Everything folder-only flag for folder filter", () => {
    expect(buildEverythingArgs(parseSearchQuery("folder: qq"))).toEqual([
      "-n",
      "200",
      "-json",
      "-attributes",
      "-size",
      "/ad",
      "qq"
    ]);
  });

  it("adds Everything file-only flag for file filter", () => {
    expect(buildEverythingArgs(parseSearchQuery("file: qq"))).toEqual([
      "-n",
      "200",
      "-json",
      "-attributes",
      "-size",
      "/a-d",
      "qq"
    ]);
  });

  it("adds extension filters for document filter", () => {
    expect(buildEverythingArgs(parseSearchQuery("doc: 毕业"))).toEqual([
      "-n",
      "200",
      "-json",
      "-attributes",
      "-size",
      "ext:doc;docx;pdf;txt;md;xls;xlsx;ppt;pptx",
      "毕业"
    ]);
  });

  it("keeps path terms in the Everything query", () => {
    expect(buildEverythingArgs(parseSearchQuery("desktop\\毕业 d:\\"))).toEqual([
      "-n",
      "200",
      "-json",
      "-attributes",
      "-size",
      "desktop\\",
      "d:\\",
      "毕业"
    ]);
  });

  it("expands pinyin aliases into an Everything OR query", () => {
    expect(expandSearchTerm("weixin")).toEqual(["weixin", "微信"]);
    expect(buildEverythingArgs(parseSearchQuery("weixin"))).toEqual([
      "-n",
      "200",
      "-json",
      "-attributes",
      "-size",
      "<weixin|微信>"
    ]);
  });

  it("builds a bounded Chinese candidate query for pinyin-like input", () => {
    const query = parseSearchQuery("weixin");

    expect(isPinyinCandidateQuery(query)).toBe(true);
    expect(buildChineseCandidateArgs(query, 300)).toEqual(["-n", "300", "-json", "-attributes", "regex:[一-龥]"]);
  });

  it("does not run pinyin candidate search for Chinese or path queries", () => {
    expect(isPinyinCandidateQuery(parseSearchQuery("微信"))).toBe(false);
    expect(isPinyinCandidateQuery(parseSearchQuery("D:\\weixin"))).toBe(false);
  });

  it("builds a bounded Chinese application candidate query for launcher-like input", () => {
    const query = parseSearchQuery("qqyy");

    expect(isApplicationPinyinCandidateQuery(query)).toBe(true);
    expect(buildChineseAppCandidateArgs(query, 120)).toEqual([
      "-n",
      "120",
      "-json",
      "-attributes",
      "-size",
      "-dm",
      "-run-count",
      "-date-run",
      "ext:exe;lnk",
      "regex:[一-龥]"
    ]);
  });

  it("does not build Chinese application candidates for file-intent queries", () => {
    expect(isApplicationPinyinCandidateQuery(parseSearchQuery("file: qqyy"))).toBe(false);
    expect(isApplicationPinyinCandidateQuery(parseSearchQuery("D:\\qqyy"))).toBe(false);
  });
});
