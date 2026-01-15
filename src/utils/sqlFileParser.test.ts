import { describe, it, expect } from "vitest";
import { parseSqlText, validateSqlFile } from "./sqlFileParser";

describe("sqlFileParser dollar-quote handling", () => {
  it("handles completed dollar-quoted function followed by INSERT with $tag$ in string", () => {
    const sql = `--
-- PostgreSQL database dump
--

BEGIN;

CREATE FUNCTION public.test_fn() RETURNS void AS $ebd3c6f0$
BEGIN
  PERFORM 1;
END;
$ebd3c6f0$ LANGUAGE plpgsql;

INSERT INTO "public"."emails" ("id", "subject", "body")
VALUES ('1', 'Test', 'Body containing $ebd3c6f0$ inside a normal string');

COMMIT;

--
-- PostgreSQL database dump complete
--;`;

    const parsed = parseSqlText(sql, sql.length);
    const validation = validateSqlFile(parsed);

    expect(parsed.metadata.isComplete).toBe(true);
    const unclosedIssues = parsed.metadata.integrityIssues.filter(
      (i) => i.type === "unclosed_quote"
    );
    expect(unclosedIssues.length).toBe(0);
    expect(validation.isValid).toBe(true);
    expect(parsed.dataStatements.length).toBe(1);
  });
});

