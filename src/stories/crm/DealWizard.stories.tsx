import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FormStepper } from '@/components/system/FormStepper';
import { FormGrid, FormItem } from '@/components/forms/FormLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const WizardDemo = () => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const steps = [
    { id: '1', label: 'Basic Info', description: 'Deal details' },
    { id: '2', label: 'Requirements', description: 'Logistics needs' },
    { id: '3', label: 'Financials', description: 'Value & Budget' },
    { id: '4', label: 'Review', description: 'Confirm' },
  ];

  const handleNext = () => setActiveStepIndex(prev => Math.min(prev + 1, steps.length - 1));
  const handlePrev = () => setActiveStepIndex(prev => Math.max(prev - 1, 0));

  return (
    <div className="p-6 bg-slate-50 min-h-screen flex justify-center items-start">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-sm border p-6">
        <h1 className="text-2xl font-bold mb-6">Create New Opportunity</h1>
        
        <FormStepper 
          steps={steps} 
          activeId={steps[activeStepIndex].id}
          onPrev={handlePrev}
          onNext={handleNext}
          className="mb-8"
        />

        <div className="mt-8">
          {activeStepIndex === 0 && (
            <FormGrid columns={2}>
              <FormItem span={2}>
                <Label>Opportunity Name</Label>
                <Input placeholder="e.g. Q3 Global Logistics Contract" />
              </FormItem>
              <FormItem>
                <Label>Account</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Select Account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acme">Acme Logistics</SelectItem>
                    <SelectItem value="global">Global Trade Inc</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
              <FormItem>
                <Label>Type</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="New Business" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New Business</SelectItem>
                    <SelectItem value="existing">Existing Business</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            </FormGrid>
          )}

          {activeStepIndex === 1 && (
            <FormGrid columns={2}>
              <FormItem>
                <Label>Origin Country</Label>
                <Input placeholder="e.g. China" />
              </FormItem>
              <FormItem>
                <Label>Destination Country</Label>
                <Input placeholder="e.g. USA" />
              </FormItem>
              <FormItem>
                <Label>Transport Mode</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Sea Freight" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sea">Sea Freight</SelectItem>
                    <SelectItem value="air">Air Freight</SelectItem>
                    <SelectItem value="rail">Rail Freight</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
              <FormItem>
                <Label>Incoterms</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="FOB" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fob">FOB</SelectItem>
                    <SelectItem value="cif">CIF</SelectItem>
                    <SelectItem value="exw">EXW</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
              <FormItem span={2}>
                <Label>Special Requirements</Label>
                <Textarea placeholder="Any specific handling instructions..." />
              </FormItem>
            </FormGrid>
          )}

          {activeStepIndex === 2 && (
            <FormGrid columns={2}>
              <FormItem>
                <Label>Estimated Value</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                  <Input className="pl-7" placeholder="0.00" />
                </div>
              </FormItem>
              <FormItem>
                <Label>Probability (%)</Label>
                <Input type="number" placeholder="50" />
              </FormItem>
              <FormItem>
                <Label>Expected Close Date</Label>
                <Input type="date" />
              </FormItem>
              <FormItem>
                <Label>Currency</Label>
                <Select defaultValue="usd">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD</SelectItem>
                    <SelectItem value="eur">EUR</SelectItem>
                    <SelectItem value="cny">CNY</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            </FormGrid>
          )}

          {activeStepIndex === 3 && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg border">
                <h3 className="font-semibold mb-2">Summary</h3>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Name</dt>
                    <dd className="font-medium">Q3 Global Logistics Contract</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Account</dt>
                    <dd className="font-medium">Acme Logistics</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Value</dt>
                    <dd className="font-medium">$150,000.00</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Mode</dt>
                    <dd className="font-medium">Sea Freight (FOB)</dd>
                  </div>
                </dl>
              </div>
              <div className="flex items-center gap-2 p-4 bg-blue-50 text-blue-700 rounded-lg text-sm">
                <span>⚠️ Please verify all financial details before submitting for approval.</span>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t">
            <button
              onClick={handlePrev}
              disabled={activeStepIndex === 0}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
            >
              {activeStepIndex === steps.length - 1 ? 'Create Opportunity' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const meta: Meta = {
  title: 'CRM/Deal Wizard',
  component: FormStepper,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

export const CreationFlow: Story = {
  render: () => <WizardDemo />
};
