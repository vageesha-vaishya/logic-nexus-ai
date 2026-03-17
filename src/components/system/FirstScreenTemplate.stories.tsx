import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FirstScreenTemplate } from "./FirstScreenTemplate";
import { EntityCard } from "./EntityCard";
import { Button } from "@/components/ui/button";
import { CRMModuleHeaderNavigation } from "@/components/crm/CRMModuleHeaderNavigation";

const meta: Meta<typeof FirstScreenTemplate> = {
  title: "System/FirstScreenTemplate",
  component: FirstScreenTemplate,
  parameters: {
    layout: "fullscreen",
    a11y: { disable: false },
  },
  argTypes: {
    title: { control: "text", description: "Page title" },
    description: { control: "text", description: "Optional subtitle text" },
    viewMode: {
      control: { type: "radio" },
      options: ["list", "card", "grid"],
      description: "Active view mode",
    },
    availableModes: {
      control: "object",
      description: "Modes shown in toggle",
    },
    onImport: { action: "import", description: "Import handler" },
    onExport: { action: "export", description: "Export handler" },
    onCreate: { action: "create", description: "Create handler" },
  },
};

export default meta;
type Story = StoryObj<typeof FirstScreenTemplate>;

const sample = Array.from({ length: 6 }).map((_, i) => ({
  id: `id-${i + 1}`,
  title: `Entity ${i + 1}`,
  subtitle: i % 2 === 0 ? "Category A" : "Category B",
  meta: "meta one • meta two",
  tags: ["Active", i % 2 === 0 ? "Tier 1" : "Tier 2"],
}));

function Content({ mode }: { mode: 'pipeline' | 'card' | 'grid' | 'list' | 'board' | 'analytics' }) {
  if (mode === "list") {
    return (
      <div className="space-y-2">
        {sample.map((s) => (
          <div key={s.id} className="flex items-center justify-between border rounded-md p-3">
            <div>
              <div className="font-medium">{s.title}</div>
              <div className="text-muted-foreground text-sm">{s.subtitle}</div>
            </div>
            <Button size="sm">Open</Button>
          </div>
        ))}
      </div>
    );
  }
  if (mode === 'analytics') {
    return (
      <div className="border rounded-md p-4">
        Analytics content placeholder
      </div>
    );
  }
  const gridClass = mode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" : "flex flex-col gap-3";
  return (
    <div className={gridClass}>
      {sample.map((s) => (
        <EntityCard key={s.id} title={s.title} subtitle={s.subtitle} meta={s.meta} tags={s.tags} />
      ))}
    </div>
  );
}

export const ListView: Story = {
  name: "List View",
  render: (args) => {
    const ListViewComponent = (props: React.ComponentProps<typeof FirstScreenTemplate>) => {
      const [mode, setMode] = useState(props.viewMode ?? "list");
      return (
        <div className="p-4">
          <FirstScreenTemplate
            {...props}
            viewMode={mode}
            availableModes={props.availableModes ?? ["list", "card", "grid"]}
            onViewModeChange={setMode}
          >
            <Content mode={mode} />
          </FirstScreenTemplate>
        </div>
      );
    };
    return <ListViewComponent {...args} />;
  },
  args: {
    title: "Entities",
    description: "Browse and manage items",
    viewMode: "list",
    breadcrumbs: [{ label: "Dashboard", to: "/" }, { label: "Entities" }],
    onImport: () => {},
    onExport: () => {},
    onCreate: () => {},
  },
};

export const CardView: Story = {
  name: "Card View",
  ...ListView,
  args: {
    ...ListView.args,
    viewMode: "card",
  },
};

export const GridView: Story = {
  name: "Grid View",
  ...ListView,
  args: {
    ...ListView.args,
    viewMode: "grid",
  },
};

export const LeadsHeaderControls: Story = {
  name: "Leads Header Controls",
  render: () => {
    const LeadsHeaderControlsStory = () => {
      const [viewMode, setViewMode] = useState<'pipeline' | 'card' | 'grid' | 'list'>('list');
      const [theme, setTheme] = useState('Azure Sky');
      const [analyticsActive, setAnalyticsActive] = useState(false);

      return (
        <div className="p-4">
          <FirstScreenTemplate
            title="Leads Workspace With Long Title For Wrapping Validation"
            description="Validates that all 9 header controls remain visible without horizontal scrolling."
            breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Leads" }]}
            actionsRight={
              <CRMModuleHeaderNavigation
                moduleLabel="Leads"
                viewMode={viewMode}
                theme={theme}
                onViewModeChange={(mode) => {
                  setAnalyticsActive(false);
                  setViewMode(mode);
                }}
                analyticsLabel="Analytics"
                analyticsActive={analyticsActive}
                onAnalyticsClick={() => setAnalyticsActive(true)}
                controlSequence={['pipeline', 'list', 'create', 'card', 'grid', 'refresh', 'analytics', 'importExport', 'theme']}
                onThemeChange={setTheme}
                onCreate={() => {}}
                createLabel="New Lead"
                iconOnly
                onRefresh={() => {}}
                onImportExport={() => {}}
              />
            }
          >
            <Content mode="list" />
          </FirstScreenTemplate>
        </div>
      );
    };

    return <LeadsHeaderControlsStory />;
  },
};
