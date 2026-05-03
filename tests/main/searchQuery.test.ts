import { describe, expect, it } from "vitest";
import { buildEverythingArgs, parseSearchQuery } from "../../src/main/searchQuery";

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
    expect(buildEverythingArgs(parseSearchQuery("folder: qq"))).toEqual(["-n", "200", "/ad", "qq"]);
  });

  it("adds Everything file-only flag for file filter", () => {
    expect(buildEverythingArgs(parseSearchQuery("file: qq"))).toEqual(["-n", "200", "/a-d", "qq"]);
  });

  it("adds extension filters for document filter", () => {
    expect(buildEverythingArgs(parseSearchQuery("doc: 毕业"))).toEqual([
      "-n",
      "200",
      "ext:doc;docx;pdf;txt;md;xls;xlsx;ppt;pptx",
      "毕业"
    ]);
  });

  it("keeps path terms in the Everything query", () => {
    expect(buildEverythingArgs(parseSearchQuery("desktop\\毕业 d:\\"))).toEqual([
      "-n",
      "200",
      "desktop\\",
      "d:\\",
      "毕业"
    ]);
  });
});
