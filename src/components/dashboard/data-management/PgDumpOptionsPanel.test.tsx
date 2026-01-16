import { render, screen, fireEvent } from "@testing-library/react";
import { PgDumpOptionsPanel, PgDumpCategoryOptions, PgDumpGeneralOptions } from "./PgDumpOptionsPanel";
import { describe, it, expect } from "vitest";
import React, { useState } from "react";

function Harness() {
  const [categories, setCategories] = useState<PgDumpCategoryOptions>({
    all: false,
    schema: true,
    constraints: true,
    indexes: true,
    dbFunctions: false,
    rlsPolicies: false,
    enums: true,
    edgeFunctions: false,
    secrets: false,
    tableData: true,
  });
  const [general, setGeneral] = useState<PgDumpGeneralOptions>({
    outputMode: "insert",
    includeDropStatements: false,
    excludeAuthSchema: true,
    excludeStorageSchema: true,
    customSchemas: "",
    baseFilename: "database_export.sql",
  });

  return (
    <PgDumpOptionsPanel
      categories={categories}
      general={general}
      onChangeCategories={setCategories}
      onChangeGeneral={setGeneral}
    />
  );
}

describe("PgDumpOptionsPanel", () => {
  it("renders and opens accordions to show components and general options", () => {
    render(<Harness />);
    const componentsTrigger = screen.getByText("Components");
    fireEvent.click(componentsTrigger);
    expect(screen.getByLabelText("Schema (Tables/Columns)")).toBeInTheDocument();
    expect(screen.getByLabelText("Constraints")).toBeInTheDocument();
    expect(screen.getByLabelText("Indexes")).toBeInTheDocument();

    const generalTrigger = screen.getByText("General");
    fireEvent.click(generalTrigger);
    expect(screen.getByText("Output Mode")).toBeInTheDocument();
    expect(screen.getByText("Include DROP Statements")).toBeInTheDocument();
    expect(screen.getByText("Exclude Auth Schema")).toBeInTheDocument();
  });

  it("toggles ALL to enable all categories", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Components"));
    const allSwitch = screen.getByLabelText("ALL");
    fireEvent.click(allSwitch);

    expect(screen.getByLabelText("Schema (Tables/Columns)")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Constraints")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Indexes")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("DB Functions")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("RLS Policies")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Enums")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Edge Functions")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Secrets (Vault)")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Table Data")).toHaveAttribute("data-state", "checked");
  });

  it("filters component tiles by search query", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Components"));
    const filterInput = screen.getByPlaceholderText("Filter options");
    fireEvent.change(filterInput, { target: { value: "Enums" } });
    expect(screen.getByLabelText("Enums")).toBeInTheDocument();
    expect(screen.queryByLabelText("Schema (Tables/Columns)")).toBeNull();
    expect(screen.queryByLabelText("Constraints")).toBeNull();
  });

  it("updates general options via select and switches", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("General"));

    const outputSection = screen.getByText("Output Mode").parentElement as HTMLElement;
    const outputTrigger = outputSection.querySelector("button") as HTMLElement;
    fireEvent.click(outputTrigger);
    fireEvent.click(screen.getByText("COPY statements"));

    const includeDropSwitch = screen.getByText("Include DROP Statements").parentElement!.querySelector('[role="switch"]') as HTMLElement;
    fireEvent.click(includeDropSwitch);

    const excludeAuthSwitch = screen.getByText("Exclude Auth Schema").parentElement!.querySelector('[role="switch"]') as HTMLElement;
    fireEvent.click(excludeAuthSwitch);

    const excludeStorageSwitch = screen.getByText("Exclude Storage Schema").parentElement!.querySelector('[role="switch"]') as HTMLElement;
    fireEvent.click(excludeStorageSwitch);

    expect(includeDropSwitch).toHaveAttribute("data-state", "checked");
    expect(excludeAuthSwitch).toHaveAttribute("data-state", "unchecked");
    expect(excludeStorageSwitch).toHaveAttribute("data-state", "unchecked");
    expect(outputSection.textContent).toContain("COPY statements");
  });

  it("validates custom schemas input and rejects invalid identifiers", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("General"));
    const input = screen.getByPlaceholderText("e.g. public,auth") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "public,auth" } });
    expect(input.value).toBe("public,auth");

    fireEvent.change(input, { target: { value: "public,auth-" } });
    expect(input.value).toBe("public,auth");
  });

  it("updates base filename input", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("General"));
    const input = screen.getByPlaceholderText("database_export.sql") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "backup.sql" } });
    expect(input.value).toBe("backup.sql");
  });

  it("applies full schema including auth/storage preset", () => {
    render(<Harness />);
    const presetButton = screen.getByText("Full schema including auth/storage");
    fireEvent.click(presetButton);

    fireEvent.click(screen.getByText("Components"));
    expect(screen.getByLabelText("Schema (Tables/Columns)")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Constraints")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Indexes")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("DB Functions")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("RLS Policies")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Enums")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Edge Functions")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Secrets (Vault)")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Table Data")).toHaveAttribute("data-state", "checked");

    fireEvent.click(screen.getByText("General"));
    const excludeAuthSwitch = screen.getByText("Exclude Auth Schema").parentElement!.querySelector('[role="switch"]') as HTMLElement;
    const excludeStorageSwitch = screen.getByText("Exclude Storage Schema").parentElement!.querySelector('[role="switch"]') as HTMLElement;
    expect(excludeAuthSwitch).toHaveAttribute("data-state", "unchecked");
    expect(excludeStorageSwitch).toHaveAttribute("data-state", "unchecked");
  });

  it("applies structure-only schema preset with auth/storage included", () => {
    render(<Harness />);
    const presetButton = screen.getByText("Structure-only schema (no data, includes auth/storage)");
    fireEvent.click(presetButton);

    fireEvent.click(screen.getByText("Components"));
    expect(screen.getByLabelText("Schema (Tables/Columns)")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Constraints")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Indexes")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("DB Functions")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("RLS Policies")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Enums")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Edge Functions")).toHaveAttribute("data-state", "unchecked");
    expect(screen.getByLabelText("Secrets (Vault)")).toHaveAttribute("data-state", "unchecked");
    expect(screen.getByLabelText("Table Data")).toHaveAttribute("data-state", "unchecked");

    fireEvent.click(screen.getByText("General"));
    const excludeAuthSwitch = screen.getByText("Exclude Auth Schema").parentElement!.querySelector('[role="switch"]') as HTMLElement;
    const excludeStorageSwitch = screen.getByText("Exclude Storage Schema").parentElement!.querySelector('[role="switch"]') as HTMLElement;
    expect(excludeAuthSwitch).toHaveAttribute("data-state", "unchecked");
    expect(excludeStorageSwitch).toHaveAttribute("data-state", "unchecked");
  });

  it("respects disabled prop and prevents interaction", () => {
    const categories: PgDumpCategoryOptions = {
      all: false,
      schema: false,
      constraints: false,
      indexes: false,
      dbFunctions: false,
      rlsPolicies: false,
      enums: false,
      edgeFunctions: false,
      secrets: false,
      tableData: false,
    };
    const general: PgDumpGeneralOptions = {
      outputMode: "insert",
      includeDropStatements: false,
      excludeAuthSchema: true,
      excludeStorageSchema: true,
      customSchemas: "",
      baseFilename: "database_export.sql",
      dataCompletenessThresholdRatio: 1.1,
    };
    const onCats = (_: PgDumpCategoryOptions) => {};
    const onGen = (_: PgDumpGeneralOptions) => {};
    render(<PgDumpOptionsPanel categories={categories} general={general} onChangeCategories={onCats} onChangeGeneral={onGen} disabled />);

    fireEvent.click(screen.getByText("Components"));
    const schemaSwitch = screen.getByLabelText("Schema (Tables/Columns)");
    fireEvent.click(schemaSwitch);
    expect(schemaSwitch).toHaveAttribute("data-state", "unchecked");

    fireEvent.click(screen.getByText("General"));
    const outputSection = screen.getByText("Output Mode").parentElement as HTMLElement;
    const outputTrigger = outputSection.querySelector("button") as HTMLElement;
    fireEvent.click(outputTrigger);
    const currentTrigger = outputSection.querySelector("button") as HTMLElement;
    expect(currentTrigger).toBeInTheDocument();
  });
});
