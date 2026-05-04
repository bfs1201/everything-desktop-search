import { describe, expect, it } from "vitest";
import {
  buildChineseCandidateArgs,
  buildEverythingArgs,
  expandSearchTerm,
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

  it("recognizes path terms containing backslash or drive prefix", () => {
    expect(parseSearchQuery("desktop\\毕业 d:\\")).toMatchObject({
      keywords: ["毕业"],
      pathTerms: ["desktop\\", "d:\\"]
    });
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
});
