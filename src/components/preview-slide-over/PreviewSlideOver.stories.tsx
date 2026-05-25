import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PreviewSlideOver } from "./PreviewSlideOver";

const meta: Meta<typeof PreviewSlideOver> = {
  title: "Platform/PreviewSlideOver",
  component: PreviewSlideOver,
  parameters: { a11y: { disable: false }, layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof PreviewSlideOver>;

export const PartPreview: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Preview Part PN-1234</Button>
        <PreviewSlideOver
          open={open}
          onOpenChange={setOpen}
          title="PN-1234 — Fuel Pump Assembly"
          subtitle="Aircraft VT-ABC · Work Order WO-2026-0182"
          fields={[
            { label: "Manufacturer", value: "Honeywell" },
            { label: "Quantity on hand", value: "3" },
            { label: "Shelf life", value: "Apr 2028" },
            { label: "Bin location", value: "A-12-04" },
            { label: "Last issued", value: "May 18, 2026" },
            { label: "Reorder point", value: "2" },
          ]}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button>Open full record</Button>
            </div>
          }
        />
      </>
    );
  },
};

export const ContactPreview: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <PreviewSlideOver
        open={open}
        onOpenChange={setOpen}
        title="Alice Kapoor"
        subtitle="VP Operations · Acme Logistics"
        fields={[
          { label: "Email", value: "alice@acme.test" },
          { label: "Phone", value: "+91 98000 12345" },
          { label: "Owner", value: "Sales — North" },
          {
            label: "Notes",
            value: "Prefers WhatsApp; budget approval tied to Q3.",
            fullWidth: true,
          },
        ]}
        actions={<Button>Open contact</Button>}
      />
    );
  },
};
