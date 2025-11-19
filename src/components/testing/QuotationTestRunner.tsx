import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Circle, XCircle, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TestCase {
  id: string;
  phase: string;
  name: string;
  description: string;
  steps: string[];
  expected: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  notes?: string;
}

export function QuotationTestRunner() {
  const [testCases] = useState<TestCase[]>([
    {
      id: "1.1",
      phase: "Phase 1",
      name: "Create Option A with Multiple Legs",
      description: "Create first option with 3 transport legs and associated charges",
      steps: [
        "Navigate to QUO-000002 in quote editor",
        "Create new option named 'Option A'",
        "Add Leg 1: Ocean freight with origin/destination ports",
        "Add charges to Leg 1: Freight ($1000 buy/$1200 sell), BAF ($50/$60), CAF ($30/$40)",
        "Add Leg 2: Rail transport",
        "Add charges to Leg 2: Rail freight ($300/$350), Terminal handling ($50/$75)",
        "Add Leg 3: Truck delivery",
        "Add charges to Leg 3: Delivery ($150/$200), Fuel surcharge ($25/$35)",
        "Add combined charges: Insurance ($100/$120), Documentation ($50/$60), Customs ($200/$250)",
        "Click 'Save Quotation'",
        "Verify success message",
      ],
      expected: "Option created with all legs and charges. Totals: Buy=$1,955, Sell=$2,390, Profit=$435, Margin=18.2%",
      status: "pending",
    },
    {
      id: "1.2",
      phase: "Phase 1",
      name: "Create Option B with Different Configuration",
      description: "Create second option with air freight configuration",
      steps: [
        "In same quotation, create new option 'Option B'",
        "Add Leg 1: Air freight",
        "Add charges: Air freight ($2000 buy/$2400 sell), Handling ($100/$150)",
        "Add Leg 2: Truck delivery from airport",
        "Add charges: Local delivery ($80/$120)",
        "Add combined charge: Insurance ($150/$180)",
        "Save quotation",
      ],
      expected: "Option B created independently. Totals: Buy=$2,330, Sell=$2,850, Profit=$520, Margin=18.2%",
      status: "pending",
    },
    {
      id: "2.1",
      phase: "Phase 2",
      name: "Update Leg Details",
      description: "Modify existing leg information without affecting charges",
      steps: [
        "Open Option A",
        "Select Leg 1 (Ocean)",
        "Change carrier from existing to different carrier",
        "Update departure date to +7 days",
        "Update origin location details",
        "Save quotation",
        "Verify leg updated but charges unchanged",
      ],
      expected: "Leg details updated, all charges preserved with same values",
      status: "pending",
    },
    {
      id: "2.2",
      phase: "Phase 2",
      name: "Update Charge Rates",
      description: "Modify buy and sell rates on existing charges",
      steps: [
        "Open Option A, Leg 1",
        "Update Freight charge: Buy $1000→$1100, Sell $1200→$1300",
        "Update BAF charge: Buy $50→$55",
        "Update quantity on CAF from 1 to 2 units",
        "Save quotation",
        "Verify new totals calculated",
      ],
      expected: "Rates updated. New leg total reflects changes. Option total recalculated correctly",
      status: "pending",
    },
    {
      id: "2.3",
      phase: "Phase 2",
      name: "Update Combined Charges",
      description: "Modify charges not tied to specific legs",
      steps: [
        "Open Option A",
        "Update Insurance: $100→$150 buy, $120→$180 sell",
        "Update Documentation: $50→$75 buy",
        "Save quotation",
      ],
      expected: "Combined charges updated, option totals reflect new values",
      status: "pending",
    },
    {
      id: "3.1",
      phase: "Phase 3",
      name: "Add Leg to Existing Option",
      description: "Insert new leg while preserving existing data",
      steps: [
        "Open Option A (should have 3 existing legs)",
        "Add new Leg 4: Barge transport",
        "Add charges: Barge freight ($200/$250), Port fees ($50/$70)",
        "Do NOT modify existing legs 1-3",
        "Save quotation",
        "Verify 4 legs exist with correct charges",
      ],
      expected: "New leg added. Existing legs unchanged. Total includes new leg costs",
      status: "pending",
    },
    {
      id: "3.2",
      phase: "Phase 3",
      name: "Add Charges to Existing Leg",
      description: "Add new charges to leg without removing old ones",
      steps: [
        "Open Option A, Leg 1",
        "Note existing charges count",
        "Add new charge: Security fee ($40/$60)",
        "Add new charge: Seal charge ($10/$15)",
        "Save quotation",
        "Count total charges on Leg 1",
      ],
      expected: "Old charges + 2 new charges all present. Leg total updated correctly",
      status: "pending",
    },
    {
      id: "3.3",
      phase: "Phase 3",
      name: "Mixed Update and Insert",
      description: "Combine updates and inserts in single save",
      steps: [
        "Open Option A",
        "Update Leg 1 carrier",
        "Add new Leg 5: Warehouse storage",
        "Update charges on Leg 2 (modify 1 rate)",
        "Add new combined charge: Handling fee ($30/$45)",
        "Save quotation",
      ],
      expected: "All operations succeed. Leg 1 updated, Leg 5 added, charges reflect changes",
      status: "pending",
    },
    {
      id: "4.1",
      phase: "Phase 4",
      name: "Delete Entire Leg",
      description: "Remove leg and verify cascade deletion of charges",
      steps: [
        "Open Option A",
        "Note total legs and charges count",
        "Delete Leg 2 (Rail)",
        "Confirm deletion in dialog",
        "Save quotation",
        "Query database for orphaned charges",
      ],
      expected: "Leg removed. All Leg 2 charges deleted. No orphans in quote_charges. Totals recalculated",
      status: "pending",
    },
    {
      id: "4.2",
      phase: "Phase 4",
      name: "Delete Individual Charges",
      description: "Remove specific charges while keeping leg intact",
      steps: [
        "Open Option A, Leg 1",
        "Delete BAF charge",
        "Open combined charges",
        "Delete Documentation fee",
        "Save quotation",
      ],
      expected: "2 charges removed. Legs remain. Totals updated. No orphaned records",
      status: "pending",
    },
    {
      id: "4.3",
      phase: "Phase 4",
      name: "Delete Multiple Items in One Save",
      description: "Complex deletion scenario",
      steps: [
        "Open Option A",
        "Delete Leg 3",
        "Delete 2 charges from Leg 1",
        "Update 1 charge rate in Leg 4",
        "Save quotation",
      ],
      expected: "All deletions processed. Update applied. No orphans. Consistent state",
      status: "pending",
    },
    {
      id: "5.1",
      phase: "Phase 5",
      name: "Empty Option Handling",
      description: "Create option without legs or charges",
      steps: [
        "Create new option 'Option C'",
        "Do not add any legs",
        "Do not add any charges",
        "Attempt to save quotation",
      ],
      expected: "Validation warning shown. Option created with $0 totals if allowed",
      status: "pending",
    },
    {
      id: "5.2",
      phase: "Phase 5",
      name: "Leg with No Charges",
      description: "Create leg without associated charges",
      steps: [
        "Create new leg in Option A",
        "Set origin/destination",
        "Do NOT add any charges",
        "Save quotation",
      ],
      expected: "Leg created. Leg totals = $0. Warning indicator shown. No errors",
      status: "pending",
    },
    {
      id: "5.3",
      phase: "Phase 5",
      name: "Massive Concurrent Update",
      description: "Stress test with many simultaneous changes",
      steps: [
        "Open Option A",
        "Update all 3-4 existing legs (carrier, dates)",
        "Update 5+ charge rates",
        "Add 2 new legs with charges",
        "Add 3 new combined charges",
        "Delete 1 old leg",
        "Save quotation",
      ],
      expected: "All ~20+ operations succeed atomically. Data consistent. Performance acceptable (<5s)",
      status: "pending",
    },
    {
      id: "7.1",
      phase: "Phase 7",
      name: "Leg-Level Cost Verification",
      description: "Verify leg cost calculations are accurate",
      steps: [
        "Open Option A, Leg 1",
        "Manually sum all buy charges for Leg 1",
        "Compare to displayed leg buy total",
        "Manually sum all sell charges for Leg 1",
        "Compare to displayed leg sell total",
        "Repeat for all legs",
      ],
      expected: "Manual calculations match displayed totals exactly for all legs",
      status: "pending",
    },
    {
      id: "7.2",
      phase: "Phase 7",
      name: "Option-Level Cost Verification",
      description: "Verify option totals aggregate correctly",
      steps: [
        "Open Option A",
        "Sum all leg buy costs + combined buy charges",
        "Compare to option total buy cost",
        "Sum all leg sell costs + combined sell charges",
        "Compare to option total sell cost",
        "Calculate profit: sell - buy",
        "Calculate margin: (profit / sell) × 100",
        "Compare to displayed values",
      ],
      expected: "All aggregations accurate. Profit and margin calculations correct to 2 decimal places",
      status: "pending",
    },
  ]);

  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [completedTests, setCompletedTests] = useState<Set<string>>(new Set());

  const getStatusIcon = (status: TestCase["status"]) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "running":
        return <AlertCircle className="h-4 w-4 text-blue-600 animate-pulse" />;
      case "skipped":
        return <Circle className="h-4 w-4 text-gray-400" />;
      default:
        return <Circle className="h-4 w-4 text-gray-300" />;
    }
  };

  const getStatusBadge = (status: TestCase["status"]) => {
    const variants: Record<TestCase["status"], "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      running: "default",
      passed: "secondary",
      failed: "destructive",
      skipped: "outline",
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const groupedTests = testCases.reduce((acc, test) => {
    if (!acc[test.phase]) acc[test.phase] = [];
    acc[test.phase].push(test);
    return acc;
  }, {} as Record<string, TestCase[]>);

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Quotation Testing Suite - QUO-000002</CardTitle>
          <CardDescription>
            Comprehensive testing for multi-modal quote composer functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {testCases.filter((t) => t.status === "passed").length}
              </div>
              <div className="text-sm text-muted-foreground">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {testCases.filter((t) => t.status === "failed").length}
              </div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {testCases.filter((t) => t.status === "running").length}
              </div>
              <div className="text-sm text-muted-foreground">Running</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {testCases.filter((t) => t.status === "pending").length}
              </div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </div>

          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-6">
              {Object.entries(groupedTests).map(([phase, tests]) => (
                <div key={phase}>
                  <h3 className="text-lg font-semibold mb-3">{phase}</h3>
                  <div className="space-y-3">
                    {tests.map((test) => (
                      <Card
                        key={test.id}
                        className={currentTest === test.id ? "border-primary" : ""}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(test.status)}
                              <div>
                                <CardTitle className="text-base">
                                  {test.id}. {test.name}
                                </CardTitle>
                                <CardDescription className="text-sm">
                                  {test.description}
                                </CardDescription>
                              </div>
                            </div>
                            {getStatusBadge(test.status)}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <div className="text-sm font-medium mb-2">Test Steps:</div>
                              <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                                {test.steps.map((step, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <Checkbox
                                      checked={completedTests.has(`${test.id}-${idx}`)}
                                      onCheckedChange={(checked) => {
                                        const newCompleted = new Set(completedTests);
                                        if (checked) {
                                          newCompleted.add(`${test.id}-${idx}`);
                                        } else {
                                          newCompleted.delete(`${test.id}-${idx}`);
                                        }
                                        setCompletedTests(newCompleted);
                                      }}
                                      className="mt-1"
                                    />
                                    <span className="flex-1">{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                            <div>
                              <div className="text-sm font-medium">Expected Result:</div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {test.expected}
                              </p>
                            </div>
                            {test.notes && (
                              <div className="bg-muted p-2 rounded text-sm">
                                <strong>Notes:</strong> {test.notes}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => setCurrentTest(test.id)}
                                variant={currentTest === test.id ? "default" : "outline"}
                              >
                                {currentTest === test.id ? "Active" : "Start Test"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  window.open(
                                    "/dashboard/quotes/multi-modal?quote=QUO-000002",
                                    "_blank"
                                  );
                                }}
                              >
                                Open in Editor
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
