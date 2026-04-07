import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { ArrowDown, CalendarDays, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc';
type AircraftWorkPackageTab = 'new-wp' | 'existing-wp' | 'non-performed-tasks' | 'selected-task' | 'all-tasks';
type WorkPackageCreateAction = 'save_draft' | 'create_schedule' | 'create_open';
type AircraftWorkPackageTaskSort = 'taskNumber' | 'ataCode' | 'description';

type AircraftWorkPackageFormValues = {
  source: 'schedule_due' | 'defect' | 'campaign' | 'predictive_alert';
  maintenanceType: 'line' | 'base' | 'hangar' | 'shop';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: '' | 'planning' | 'scheduled' | 'in_progress' | 'blocked';
  validationState: '' | 'pending' | 'validated' | 'not_validated';
  plannedStart: string;
  plannedEnd: string;
  station: string;
  workPackageNumber: string;
  topic: string;
  ttafHours: string;
  openingDate: string;
  revisionNumber: string;
  revisionDate: string;
  transmissionDate: string;
  maintenanceReleaseDate: string;
  workReportNumber: string;
  expectedReceptionDate: string;
  workReceptionDate: string;
  comments: string;
  selectedTaskNumber: string;
  selectedTaskAtaCode: string;
  selectedTaskSerialNumber: string;
  selectedTaskPartNumber: string;
  selectedTaskDescription: string;
  scopeItemsText: string;
};

type WorkPackageTemplateRegistryItem = {
  id: string;
  templateCode: string;
  templateName: string;
  description: string;
  maintenanceType: 'line' | 'base' | 'hangar' | 'shop';
  version: string;
  active: boolean;
  scopeItems: string[];
  taskRows: Array<{
    id: string;
    taskNumber: string;
    ataCode: string;
    serialNumber: string;
    partNumber: string;
    description: string;
  }>;
};

type AircraftWorkPackageTaskListItem = {
  id: string;
  taskNumber: string;
  ataCode: string;
  serialNumber: string;
  partNumber: string;
  description: string;
  status: string;
  selectable: boolean;
  source: 'template' | 'existing_wp' | 'scope' | 'selected';
  parentWorkPackageId?: string;
  parentWorkPackageNumber?: string;
};

type AircraftWorkPackagePreviewTask = {
  id: string;
  taskNumber: string;
  ataCode: string;
  serialNumber: string;
  partNumber: string;
  description: string;
};

type AircraftWorkPackageRecordSummary = {
  id: string;
  workPackageNumber: string;
  title: string;
  status: string;
  maintenanceType: string;
  priority: string;
  station: string;
  updatedAt: string;
  tasks: AircraftWorkPackageTaskListItem[];
};

type AircraftTemplateAssociatedTaskRow = {
  id: string;
  codeFormNo: string;
  ataCode: string;
  referenceAmp: string;
  description: string;
  categoryCode: string;
  estimatedManHours: string;
  isMandatory: boolean;
  jsonDetails: string;
};

type AircraftWorkPackageCreateDialogProps = {
  aircraftWorkPackageDialogOpen: boolean;
  setAircraftWorkPackageDialogOpen: (open: boolean) => void;
  aircraftWorkPackageActiveTab: AircraftWorkPackageTab;
  setAircraftWorkPackageActiveTab: (tab: AircraftWorkPackageTab) => void;
  aircraftWorkPackageValues: AircraftWorkPackageFormValues;
  aircraftWorkPackageErrors: Record<string, string>;
  setAircraftWorkPackageField: (key: keyof AircraftWorkPackageFormValues, value: string) => void;
  selectedWorkPackageTemplateId: string;
  handleAircraftWorkPackageTemplateSelect: (templateId: string) => void;
  workPackageTemplateRegistryLoading: boolean;
  workPackageTemplateRegistry: WorkPackageTemplateRegistryItem[];
  workPackageTemplateRegistryError: string;
  selectedWorkPackageTemplate: WorkPackageTemplateRegistryItem | null;
  aircraftWorkPackagePagedTasks: AircraftWorkPackagePreviewTask[];
  aircraftWorkPackageSelectedTaskIds: string[];
  handleAircraftWorkPackageTaskSelection: (task: AircraftWorkPackageTaskListItem, checked: boolean) => void;
  setAircraftWorkPackageSelectedTaskIds: Dispatch<SetStateAction<string[]>>;
  aircraftWorkPackageTaskSort: AircraftWorkPackageTaskSort;
  setAircraftWorkPackageTaskSort: Dispatch<SetStateAction<AircraftWorkPackageTaskSort>>;
  setAircraftWorkPackageTaskSortDirection: Dispatch<SetStateAction<SortDirection>>;
  aircraftWorkPackageTaskPage: number;
  setAircraftWorkPackageTaskPage: Dispatch<SetStateAction<number>>;
  aircraftWorkPackageTaskTotalPages: number;
  loadWorkPackageTemplateRegistry: () => Promise<void> | void;
  aircraftSelectedExistingWorkPackageId: string;
  setAircraftSelectedExistingWorkPackageId: (value: string) => void;
  aircraftExistingWorkPackagesError: string;
  aircraftExistingWorkPackagesLoading: boolean;
  aircraftExistingWorkPackageList: AircraftWorkPackageRecordSummary[];
  handleApplyExistingWorkPackageSelection: () => void;
  aircraftTaskGridFilteredRows: AircraftWorkPackageTaskListItem[];
  aircraftWorkPackageSubmitting: boolean;
  handleAircraftWorkPackageSubmit: (action: WorkPackageCreateAction) => Promise<void> | void;
  canCreateWorkPackageFromTemplate: boolean;
  associatedTemplateTasks: AircraftTemplateAssociatedTaskRow[];
  associatedTemplateTasksLoading: boolean;
  associatedTemplateTasksError: string;
};

export function AircraftWorkPackageCreateDialog({
  aircraftWorkPackageDialogOpen,
  setAircraftWorkPackageDialogOpen,
  aircraftWorkPackageActiveTab,
  setAircraftWorkPackageActiveTab,
  aircraftWorkPackageValues,
  aircraftWorkPackageErrors,
  setAircraftWorkPackageField,
  selectedWorkPackageTemplateId,
  handleAircraftWorkPackageTemplateSelect,
  workPackageTemplateRegistryLoading,
  workPackageTemplateRegistry,
  workPackageTemplateRegistryError,
  selectedWorkPackageTemplate,
  aircraftWorkPackagePagedTasks,
  aircraftWorkPackageSelectedTaskIds,
  handleAircraftWorkPackageTaskSelection,
  setAircraftWorkPackageSelectedTaskIds,
  aircraftWorkPackageTaskSort,
  setAircraftWorkPackageTaskSort,
  setAircraftWorkPackageTaskSortDirection,
  aircraftWorkPackageTaskPage,
  setAircraftWorkPackageTaskPage,
  aircraftWorkPackageTaskTotalPages,
  loadWorkPackageTemplateRegistry,
  aircraftSelectedExistingWorkPackageId,
  setAircraftSelectedExistingWorkPackageId,
  aircraftExistingWorkPackagesError,
  aircraftExistingWorkPackagesLoading,
  aircraftExistingWorkPackageList,
  handleApplyExistingWorkPackageSelection,
  aircraftTaskGridFilteredRows,
  aircraftWorkPackageSubmitting,
  handleAircraftWorkPackageSubmit,
  canCreateWorkPackageFromTemplate,
  associatedTemplateTasks,
  associatedTemplateTasksLoading,
  associatedTemplateTasksError,
}: AircraftWorkPackageCreateDialogProps) {
  const [associatedTaskFilters, setAssociatedTaskFilters] = useState({
    codeFormNo: '',
    ataCode: '',
    referenceAmp: '',
    description: '',
    categoryCode: '',
    estimatedManHours: '',
    isMandatory: '',
  });

  const filteredAssociatedTemplateTasks = useMemo(() => {
    const filterToken = (value: string) => value.trim().toLowerCase();
    const codeFormNoToken = filterToken(associatedTaskFilters.codeFormNo);
    const ataCodeToken = filterToken(associatedTaskFilters.ataCode);
    const referenceAmpToken = filterToken(associatedTaskFilters.referenceAmp);
    const descriptionToken = filterToken(associatedTaskFilters.description);
    const categoryCodeToken = filterToken(associatedTaskFilters.categoryCode);
    const estimatedManHoursToken = filterToken(associatedTaskFilters.estimatedManHours);
    const isMandatoryToken = filterToken(associatedTaskFilters.isMandatory);
    return associatedTemplateTasks.filter((task) => {
      if (codeFormNoToken && !String(task.codeFormNo || '').toLowerCase().includes(codeFormNoToken)) return false;
      if (ataCodeToken && !String(task.ataCode || '').toLowerCase().includes(ataCodeToken)) return false;
      if (referenceAmpToken && !String(task.referenceAmp || '').toLowerCase().includes(referenceAmpToken)) return false;
      if (descriptionToken && !String(task.description || '').toLowerCase().includes(descriptionToken)) return false;
      if (categoryCodeToken && !String(task.categoryCode || '').toLowerCase().includes(categoryCodeToken)) return false;
      if (estimatedManHoursToken && !String(task.estimatedManHours || '').toLowerCase().includes(estimatedManHoursToken)) return false;
      if (isMandatoryToken && !String(task.isMandatory ? 'true' : 'false').includes(isMandatoryToken)) return false;
      return true;
    });
  }, [associatedTaskFilters, associatedTemplateTasks]);

  return (
    <Dialog open={aircraftWorkPackageDialogOpen} onOpenChange={setAircraftWorkPackageDialogOpen}>
      <DialogContent className="mdm-template-dialog mdm-template-dialog-large h-[96vh] w-[98.5vw] max-h-[96vh] max-w-[1840px] overflow-hidden p-0" data-testid="amro-aircraft-work-package-dialog">
        <DialogHeader className="border-b border-[#efefef] px-5 py-3">
          <DialogTitle className="text-[36px] font-semibold leading-none text-[#4c4c4c]">
            Add work package
          </DialogTitle>
        </DialogHeader>
        <div className="flex h-full flex-col space-y-1 bg-[#f8f8f8] px-3 pb-2 pt-1">
          <Tabs
            value={aircraftWorkPackageActiveTab}
            onValueChange={(value) => setAircraftWorkPackageActiveTab((['new-wp', 'existing-wp', 'non-performed-tasks', 'selected-task', 'all-tasks'].includes(value) ? value : 'selected-task') as AircraftWorkPackageTab)}
          >
            <TabsList className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0">
              <TabsTrigger value="new-wp" onClick={() => setAircraftWorkPackageActiveTab('new-wp')} className="h-[20px] rounded-none border border-r-0 border-[#d7d7d7] px-[7px] text-[10px] font-semibold leading-none text-[#6a6a6a] data-[state=active]:border-[#12aeb1] data-[state=active]:bg-[#12aeb1] data-[state=active]:text-white">New WP</TabsTrigger>
              <TabsTrigger value="existing-wp" onClick={() => setAircraftWorkPackageActiveTab('existing-wp')} className="h-[20px] rounded-none border border-r-0 border-[#d7d7d7] px-[7px] text-[10px] font-semibold leading-none text-[#6a6a6a] data-[state=active]:border-[#12aeb1] data-[state=active]:bg-[#12aeb1] data-[state=active]:text-white">Existing WP</TabsTrigger>
              <TabsTrigger value="non-performed-tasks" onClick={() => setAircraftWorkPackageActiveTab('non-performed-tasks')} className="h-[20px] rounded-none border border-r-0 border-[#d7d7d7] px-[7px] text-[10px] font-semibold leading-none text-[#6a6a6a] data-[state=active]:border-[#12aeb1] data-[state=active]:bg-[#12aeb1] data-[state=active]:text-white">Non performed tasks</TabsTrigger>
              <TabsTrigger value="selected-task" onClick={() => setAircraftWorkPackageActiveTab('selected-task')} className="h-[20px] rounded-none border border-r-0 border-[#d7d7d7] px-[7px] text-[10px] font-semibold leading-none text-[#6a6a6a] data-[state=active]:border-[#12aeb1] data-[state=active]:bg-[#12aeb1] data-[state=active]:text-white">Selected task</TabsTrigger>
              <TabsTrigger value="all-tasks" onClick={() => setAircraftWorkPackageActiveTab('all-tasks')} className="h-[20px] rounded-none border border-[#d7d7d7] px-[7px] text-[10px] font-semibold leading-none text-[#6a6a6a] data-[state=active]:border-[#12aeb1] data-[state=active]:bg-[#12aeb1] data-[state=active]:text-white">All Tasks</TabsTrigger>
            </TabsList>
            <TabsContent value="selected-task" className="space-y-2 pt-1">
              <div className="grid gap-2 lg:grid-cols-[1.06fr_0.94fr]">
                <div className="overflow-hidden border border-[#e5e5e5] bg-white">
                  <div className="border-b border-[#efefef] bg-[#fafafa] px-[10px] py-[6px] text-[13px] font-semibold text-[#757575]">Work Package details</div>
                  <div className="grid gap-2 p-2.5 lg:grid-cols-2">
                    <div className="space-y-[6px]">
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-wp-number" className="text-[12px] font-medium text-[#696969]">Number</Label>
                        <Input
                          id="aircraft-wp-number"
                          value={aircraftWorkPackageValues.workPackageNumber}
                          onChange={(event) => setAircraftWorkPackageField('workPackageNumber', event.target.value)}
                          className={cn('h-[26px] rounded-none border-[#eeeeee] bg-white px-2 text-[11px] text-[#525252] shadow-none', aircraftWorkPackageErrors.workPackageNumber && 'border-destructive')}
                          aria-invalid={Boolean(aircraftWorkPackageErrors.workPackageNumber)}
                          placeholder="145"
                        />
                        {aircraftWorkPackageErrors.workPackageNumber ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.workPackageNumber}</p> : null}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-wp-topic" className="text-[12px] font-medium text-[#696969]">Topic</Label>
                        <Input
                          id="aircraft-wp-topic"
                          value={aircraftWorkPackageValues.topic}
                          onChange={(event) => setAircraftWorkPackageField('topic', event.target.value)}
                          className={cn('h-[26px] rounded-none border-[#eeeeee] bg-white px-2 text-[11px] text-[#525252] shadow-none', aircraftWorkPackageErrors.topic && 'border-destructive')}
                          aria-invalid={Boolean(aircraftWorkPackageErrors.topic)}
                          placeholder="400 Hour Inspection"
                        />
                        {aircraftWorkPackageErrors.topic ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.topic}</p> : null}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-wp-ttaf" className="text-[12px] font-medium text-[#696969]">TTAF</Label>
                        <Input
                          id="aircraft-wp-ttaf"
                          value={aircraftWorkPackageValues.ttafHours}
                          onChange={(event) => setAircraftWorkPackageField('ttafHours', event.target.value)}
                          className={cn('h-[26px] rounded-none border-[#eeeeee] bg-white px-2 text-[11px] text-[#525252] shadow-none', aircraftWorkPackageErrors.ttafHours && 'border-destructive')}
                          aria-invalid={Boolean(aircraftWorkPackageErrors.ttafHours)}
                          placeholder="406.30 hours"
                        />
                        {aircraftWorkPackageErrors.ttafHours ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.ttafHours}</p> : null}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-wp-validation" className="text-[12px] font-medium text-[#696969]">Validation</Label>
                        <Select value={aircraftWorkPackageValues.validationState} onValueChange={(value) => setAircraftWorkPackageField('validationState', value)}>
                          <SelectTrigger id="aircraft-wp-validation" className={cn('h-[26px] rounded-none border-[#eeeeee] bg-white px-2 text-[11px] text-[#525252] shadow-none', aircraftWorkPackageErrors.validationState && 'border-destructive')}>
                            <SelectValue placeholder="NEEDED" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="validated">Validated</SelectItem>
                            <SelectItem value="not_validated">Not Validated</SelectItem>
                          </SelectContent>
                        </Select>
                        {aircraftWorkPackageErrors.validationState ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.validationState}</p> : null}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-wp-transmission-date" className="text-[12px] font-medium text-[#696969]">Transmission date</Label>
                        <div className="relative">
                          <Input
                            id="aircraft-wp-transmission-date"
                            type="text"
                            value={aircraftWorkPackageValues.transmissionDate}
                            onChange={(event) => setAircraftWorkPackageField('transmissionDate', event.target.value)}
                            className={cn('h-[26px] rounded-none border-[#eeeeee] bg-white px-2 pr-7 text-[11px] text-[#525252] shadow-none', aircraftWorkPackageErrors.transmissionDate && 'border-destructive')}
                            aria-invalid={Boolean(aircraftWorkPackageErrors.transmissionDate)}
                            placeholder="yyyy-mm-dd"
                          />
                          <CalendarDays className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#e36c59]" />
                        </div>
                        {aircraftWorkPackageErrors.transmissionDate ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.transmissionDate}</p> : null}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-wp-maintenance-release" className="text-[12px] font-medium text-[#696969]">Maintenance release date</Label>
                        <div className="relative">
                          <Input
                            id="aircraft-wp-maintenance-release"
                            type="text"
                            value={aircraftWorkPackageValues.maintenanceReleaseDate}
                            onChange={(event) => setAircraftWorkPackageField('maintenanceReleaseDate', event.target.value)}
                            className={cn('h-[26px] rounded-none border-[#eeeeee] bg-white px-2 pr-7 text-[11px] text-[#525252] shadow-none', aircraftWorkPackageErrors.maintenanceReleaseDate && 'border-destructive')}
                            aria-invalid={Boolean(aircraftWorkPackageErrors.maintenanceReleaseDate)}
                            placeholder="yyyy-mm-dd"
                          />
                          <CalendarDays className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#e36c59]" />
                        </div>
                        {aircraftWorkPackageErrors.maintenanceReleaseDate ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.maintenanceReleaseDate}</p> : null}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-wp-work-report" className="text-[12px] font-medium text-[#696969]">Work report number</Label>
                        <Input
                          id="aircraft-wp-work-report"
                          value={aircraftWorkPackageValues.workReportNumber}
                          onChange={(event) => setAircraftWorkPackageField('workReportNumber', event.target.value)}
                          className="h-[26px] rounded-none border-[#eeeeee] bg-white px-2 text-[11px] text-[#525252] shadow-none"
                          placeholder=" "
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-wp-comments" className="text-[12px] font-medium text-[#696969]">Comments</Label>
                        <Textarea
                          id="aircraft-wp-comments"
                          value={aircraftWorkPackageValues.comments}
                          onChange={(event) => setAircraftWorkPackageField('comments', event.target.value)}
                          className="min-h-[48px] rounded-none border-[#eeeeee] px-2 py-1 text-[11px] text-[#525252] shadow-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-[6px]">
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-wp-revision-number" className="text-[12px] font-medium text-[#696969]">Revision</Label>
                        <Input
                          id="aircraft-wp-revision-number"
                          value={aircraftWorkPackageValues.revisionNumber}
                          onChange={(event) => setAircraftWorkPackageField('revisionNumber', event.target.value)}
                          className={cn('h-[26px] rounded-none border-[#eeeeee] bg-white px-2 text-[11px] text-[#525252] shadow-none', aircraftWorkPackageErrors.revisionNumber && 'border-destructive')}
                          aria-invalid={Boolean(aircraftWorkPackageErrors.revisionNumber)}
                          placeholder="2"
                        />
                        {aircraftWorkPackageErrors.revisionNumber ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.revisionNumber}</p> : null}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-wp-opening-date" className="text-[12px] font-medium text-[#696969]">Opening date</Label>
                        <div className="relative">
                          <Input
                            id="aircraft-wp-opening-date"
                            type="text"
                            value={aircraftWorkPackageValues.openingDate}
                            onChange={(event) => setAircraftWorkPackageField('openingDate', event.target.value)}
                            className={cn('h-[26px] rounded-none border-[#eeeeee] bg-white px-2 pr-7 text-[11px] text-[#525252] shadow-none', aircraftWorkPackageErrors.openingDate && 'border-destructive')}
                            aria-invalid={Boolean(aircraftWorkPackageErrors.openingDate)}
                            placeholder="yyyy-mm-dd"
                          />
                          <CalendarDays className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#e36c59]" />
                        </div>
                        {aircraftWorkPackageErrors.openingDate ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.openingDate}</p> : null}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-wp-status" className="text-[12px] font-medium text-[#696969]">Status</Label>
                        <Select value={aircraftWorkPackageValues.status} onValueChange={(value) => setAircraftWorkPackageField('status', value)}>
                          <SelectTrigger id="aircraft-wp-status" className={cn('h-[26px] rounded-none border-[#eeeeee] bg-white px-2 text-[11px] text-[#525252] shadow-none', aircraftWorkPackageErrors.status && 'border-destructive')}>
                            <SelectValue placeholder="OPEN" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="planning">Planning</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                        {aircraftWorkPackageErrors.status ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.status}</p> : null}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-wp-trigger-source" className="text-[12px] font-medium text-[#696969]">Trigger source</Label>
                        <Select value={aircraftWorkPackageValues.source} onValueChange={(value) => setAircraftWorkPackageField('source', value)}>
                          <SelectTrigger id="aircraft-wp-trigger-source" className={cn('h-[26px] rounded-none border-[#eeeeee] bg-white px-2 text-[11px] text-[#525252] shadow-none', aircraftWorkPackageErrors.source && 'border-destructive')}>
                            <SelectValue placeholder="Schedule Due" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="schedule_due">Schedule Due</SelectItem>
                            <SelectItem value="defect">Defect</SelectItem>
                            <SelectItem value="campaign">Campaign</SelectItem>
                            <SelectItem value="predictive_alert">Predictive Alert</SelectItem>
                          </SelectContent>
                        </Select>
                        {aircraftWorkPackageErrors.source ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.source}</p> : null}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-wp-expected-reception" className="text-[12px] font-medium text-[#696969]">Expected reception date</Label>
                        <div className="relative">
                          <Input
                            id="aircraft-wp-expected-reception"
                            type="text"
                            value={aircraftWorkPackageValues.expectedReceptionDate}
                            onChange={(event) => setAircraftWorkPackageField('expectedReceptionDate', event.target.value)}
                            className={cn('h-[26px] rounded-none border-[#eeeeee] bg-white px-2 pr-7 text-[11px] text-[#525252] shadow-none', aircraftWorkPackageErrors.expectedReceptionDate && 'border-destructive')}
                            aria-invalid={Boolean(aircraftWorkPackageErrors.expectedReceptionDate)}
                            placeholder="yyyy-mm-dd"
                          />
                          <CalendarDays className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#e36c59]" />
                        </div>
                        {aircraftWorkPackageErrors.expectedReceptionDate ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.expectedReceptionDate}</p> : null}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="aircraft-wp-work-reception" className="text-[12px] font-medium text-[#696969]">Work reception date</Label>
                        <div className="relative">
                          <Input
                            id="aircraft-wp-work-reception"
                            type="text"
                            value={aircraftWorkPackageValues.workReceptionDate}
                            onChange={(event) => setAircraftWorkPackageField('workReceptionDate', event.target.value)}
                            className={cn('h-[26px] rounded-none border-[#eeeeee] bg-white px-2 pr-7 text-[11px] text-[#525252] shadow-none', aircraftWorkPackageErrors.workReceptionDate && 'border-destructive')}
                            aria-invalid={Boolean(aircraftWorkPackageErrors.workReceptionDate)}
                            placeholder="yyyy-mm-dd"
                          />
                          <CalendarDays className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#e36c59]" />
                        </div>
                        {aircraftWorkPackageErrors.workReceptionDate ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.workReceptionDate}</p> : null}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="overflow-hidden border border-[#e5e5e5] bg-white">
                  <div className="border-b border-[#efefef] bg-[#fafafa] px-[10px] py-[6px] text-[13px] font-semibold text-[#757575]">Selected task</div>
                  <div className="space-y-2 p-2.5">
                    <div className="space-y-1">
                      <Label htmlFor="aircraft-wp-template-inline" className="text-[11px] font-medium text-[#696969]">
                        Template registry
                      </Label>
                      <select
                        id="aircraft-wp-template-inline"
                        aria-label="Template registry"
                        value={selectedWorkPackageTemplateId}
                        onChange={(event) => handleAircraftWorkPackageTemplateSelect(event.target.value)}
                        className={cn(
                          'h-[26px] w-full rounded-none border bg-white px-2 text-[11px] text-[#4f4f4f] transition-all',
                          aircraftWorkPackageErrors.templateRegistry ? 'border-destructive' : 'border-[#e7e7e7]',
                        )}
                        disabled={workPackageTemplateRegistryLoading}
                      >
                        <option value="">{workPackageTemplateRegistryLoading ? 'Loading templates...' : 'Choose template'}</option>
                        {workPackageTemplateRegistry.map((template) => (
                          <option key={template.id} value={template.id}>
                            {`${template.templateName || template.templateCode || template.id} · v${template.version}${template.description ? ` · ${template.description}` : ''}`}
                          </option>
                        ))}
                      </select>
                      {workPackageTemplateRegistryLoading ? <p className="text-[11px] text-[#6a6a6a] transition-opacity duration-200" role="status">Loading template registry…</p> : null}
                      {!workPackageTemplateRegistryLoading && workPackageTemplateRegistry.length === 0 && !workPackageTemplateRegistryError ? <p className="text-[11px] text-[#6a6a6a]">No templates available. Add templates in Template Registry and refresh.</p> : null}
                      {workPackageTemplateRegistryError ? <p className="mdm-template-danger">{workPackageTemplateRegistryError}</p> : null}
                      {aircraftWorkPackageErrors.templateRegistry ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.templateRegistry}</p> : null}
                    </div>
                    {selectedWorkPackageTemplate ? (
                      <div className="rounded-sm border border-[#e8f2f3] bg-[#f4fbfb] px-2 py-1 text-[11px] text-[#346569] transition-all duration-200">
                        <p className="font-semibold">{selectedWorkPackageTemplate.templateName || selectedWorkPackageTemplate.templateCode}</p>
                        <p className="text-[10px] text-[#4d7f83]">
                          {`Code ${selectedWorkPackageTemplate.templateCode || '-'} · v${selectedWorkPackageTemplate.version}`}
                        </p>
                        {selectedWorkPackageTemplate.description ? <p className="text-[10px] text-[#4d7f83]">{selectedWorkPackageTemplate.description}</p> : null}
                      </div>
                    ) : null}
                    <div className="flex items-center -space-x-1">
                      <Avatar className="h-4 w-4 border border-white">
                        <AvatarFallback className="bg-[#2ab8bd] p-0 text-white">
                          <Users className="h-2.5 w-2.5" />
                        </AvatarFallback>
                      </Avatar>
                      <Avatar className="h-4 w-4 border border-white">
                        <AvatarFallback className="bg-[#2ab8bd] p-0 text-white">
                          <Users className="h-2.5 w-2.5" />
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    {aircraftWorkPackageErrors.selectedTaskDescription ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.selectedTaskDescription}</p> : null}
                    <div className="rounded-none border border-[#eeeeee] bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-[#ededed] bg-[#f9f9f9]">
                            <TableHead className="h-[30px] w-[56px] px-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  aria-label="Select all tasks in page"
                                  checked={aircraftWorkPackagePagedTasks.length > 0 && aircraftWorkPackagePagedTasks.every((task) => aircraftWorkPackageSelectedTaskIds.includes(task.id))}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      aircraftWorkPackagePagedTasks.forEach((task) => handleAircraftWorkPackageTaskSelection({
                                        id: task.id,
                                        taskNumber: task.taskNumber,
                                        ataCode: task.ataCode,
                                        serialNumber: task.serialNumber,
                                        partNumber: task.partNumber,
                                        description: task.description,
                                        status: 'pending',
                                        selectable: true,
                                        source: 'selected',
                                      }, true));
                                    } else {
                                      setAircraftWorkPackageSelectedTaskIds((previous) => previous.filter((id) => !aircraftWorkPackagePagedTasks.some((task) => task.id === id)));
                                    }
                                  }}
                                />
                                <span className="text-[12px] font-semibold text-[#4f4f4f]">Select</span>
                              </div>
                            </TableHead>
                            <TableHead className="h-[30px] px-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (aircraftWorkPackageTaskSort === 'taskNumber') {
                                    setAircraftWorkPackageTaskSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
                                    return;
                                  }
                                  setAircraftWorkPackageTaskSort('taskNumber');
                                  setAircraftWorkPackageTaskSortDirection('asc');
                                }}
                                className="inline-flex items-center gap-1 text-left text-[12px] font-semibold text-[#4f4f4f]"
                              >
                                Task number
                                <ArrowDown className="h-3 w-3 text-[#888888]" />
                              </button>
                            </TableHead>
                            <TableHead className="h-[30px] px-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (aircraftWorkPackageTaskSort === 'ataCode') {
                                    setAircraftWorkPackageTaskSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
                                    return;
                                  }
                                  setAircraftWorkPackageTaskSort('ataCode');
                                  setAircraftWorkPackageTaskSortDirection('asc');
                                }}
                                className="inline-flex items-center gap-1 text-left text-[12px] font-semibold text-[#4f4f4f]"
                              >
                                ATA code
                                <ArrowDown className="h-3 w-3 text-[#888888]" />
                              </button>
                            </TableHead>
                            <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">Serial Number</TableHead>
                            <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">Part number</TableHead>
                            <TableHead className="h-[30px] px-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (aircraftWorkPackageTaskSort === 'description') {
                                    setAircraftWorkPackageTaskSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
                                    return;
                                  }
                                  setAircraftWorkPackageTaskSort('description');
                                  setAircraftWorkPackageTaskSortDirection('asc');
                                }}
                                className="inline-flex items-center gap-1 text-left text-[12px] font-semibold text-[#4f4f4f]"
                              >
                                Description
                                <ArrowDown className="h-3 w-3 text-[#888888]" />
                              </button>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {aircraftWorkPackagePagedTasks.map((task) => (
                            <TableRow key={task.id} className="h-[30px] border-b border-[#f0f0f0]">
                              <TableCell className="px-2 py-1">
                                <Checkbox
                                  aria-label={`Select task ${task.taskNumber || task.id}`}
                                  checked={aircraftWorkPackageSelectedTaskIds.includes(task.id)}
                                  onCheckedChange={(checked) => handleAircraftWorkPackageTaskSelection({
                                    id: task.id,
                                    taskNumber: task.taskNumber,
                                    ataCode: task.ataCode,
                                    serialNumber: task.serialNumber,
                                    partNumber: task.partNumber,
                                    description: task.description,
                                    status: 'pending',
                                    selectable: true,
                                    source: 'selected',
                                  }, Boolean(checked))}
                                />
                              </TableCell>
                              <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.taskNumber || '1'}</TableCell>
                              <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.ataCode || '05-20 TIME LIMITS/MAINTENANCE CHECKS'}</TableCell>
                              <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.serialNumber || 'T34-AMS1'}</TableCell>
                              <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.partNumber || ''}</TableCell>
                              <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.description || '400 Hour inspection'}</TableCell>
                            </TableRow>
                          ))}
                          {aircraftWorkPackagePagedTasks.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground">
                                No tasks match the current filter.
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center text-[11px] font-semibold text-[#6f6f6f]">
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setAircraftWorkPackageTaskPage(1)} disabled={aircraftWorkPackageTaskPage <= 1}>{'<<'}</button>
                        <button type="button" onClick={() => setAircraftWorkPackageTaskPage((previous) => Math.max(1, previous - 1))} disabled={aircraftWorkPackageTaskPage <= 1}>{'<'}</button>
                        <span>{Math.min(aircraftWorkPackageTaskPage, aircraftWorkPackageTaskTotalPages)}</span>
                        <button type="button" onClick={() => setAircraftWorkPackageTaskPage((previous) => Math.min(aircraftWorkPackageTaskTotalPages, previous + 1))} disabled={aircraftWorkPackageTaskPage >= aircraftWorkPackageTaskTotalPages}>{'>'}</button>
                        <button type="button" onClick={() => setAircraftWorkPackageTaskPage(aircraftWorkPackageTaskTotalPages)} disabled={aircraftWorkPackageTaskPage >= aircraftWorkPackageTaskTotalPages}>{'>>'}</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="new-wp" className="space-y-3 rounded-md border p-4">
              <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
                <div className="space-y-1">
                  <Label htmlFor="aircraft-wp-template" className="text-[12px] font-medium text-[#696969]">
                    Template registry
                  </Label>
                  <select
                    id="aircraft-wp-template"
                    aria-label="Template registry"
                    value={selectedWorkPackageTemplateId}
                    onChange={(event) => handleAircraftWorkPackageTemplateSelect(event.target.value)}
                    className={cn(
                      'h-8 w-full rounded-none border bg-white px-2 text-[12px] text-[#4f4f4f]',
                      aircraftWorkPackageErrors.templateRegistry ? 'border-destructive' : 'border-[#e7e7e7]',
                    )}
                    disabled={workPackageTemplateRegistryLoading}
                  >
                    <option value="">{workPackageTemplateRegistryLoading ? 'Loading templates...' : 'Choose template'}</option>
                    {workPackageTemplateRegistry.map((template) => (
                      <option key={template.id} value={template.id}>
                        {`${template.templateName || template.templateCode || template.id} · v${template.version}${template.description ? ` · ${template.description}` : ''}`}
                      </option>
                    ))}
                  </select>
                  {workPackageTemplateRegistryLoading ? <p className="text-[11px] text-[#6a6a6a] transition-opacity duration-200" role="status">Loading template registry…</p> : null}
                  {!workPackageTemplateRegistryLoading && workPackageTemplateRegistry.length === 0 && !workPackageTemplateRegistryError ? <p className="text-[11px] text-[#6a6a6a]">No templates available. Add templates in Template Registry and refresh.</p> : null}
                  {workPackageTemplateRegistryError ? <p className="mdm-template-danger">{workPackageTemplateRegistryError}</p> : null}
                  {aircraftWorkPackageErrors.templateRegistry ? <p className="mdm-template-danger">{aircraftWorkPackageErrors.templateRegistry}</p> : null}
                </div>
                <div className="rounded-sm border border-[#efefef] bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-[#8a8a8a]">Maintenance</p>
                  <p className="text-[12px] font-semibold text-[#4f4f4f]">{selectedWorkPackageTemplate?.maintenanceType || aircraftWorkPackageValues.maintenanceType}</p>
                </div>
                <div className="rounded-sm border border-[#efefef] bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-[#8a8a8a]">Scope items</p>
                  <p className="text-[12px] font-semibold text-[#4f4f4f]">{selectedWorkPackageTemplate?.scopeItems.length || 0}</p>
                </div>
                <div className="rounded-sm border border-[#efefef] bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-[#8a8a8a]">Tasks</p>
                  <p className="text-[12px] font-semibold text-[#4f4f4f]">{associatedTemplateTasks.length || selectedWorkPackageTemplate?.taskRows.length || 0}</p>
                </div>
              </div>
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-none border-[#b6d2d4] text-[11px] text-[#2b8f95]"
                  onClick={() => void loadWorkPackageTemplateRegistry()}
                  disabled={workPackageTemplateRegistryLoading}
                >
                  {workPackageTemplateRegistryLoading ? 'Refreshing…' : 'Refresh Templates'}
                </Button>
              </div>
              <div className="rounded-sm border border-[#efefef] bg-[#fafafa] p-3 transition-all duration-200">
                <p className="text-[11px] font-medium text-[#6a6a6a]">
                  {selectedWorkPackageTemplate
                    ? `${selectedWorkPackageTemplate.templateName || selectedWorkPackageTemplate.templateCode} selected. Open "Selected task" to review and adjust mapped tasks before creating the new work package.`
                    : 'Choose a template to prefill maintenance type, scope, and task selections.'}
                </p>
              </div>
              <div className="overflow-x-auto border border-[#e9e9e9] bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[#ededed] bg-[#f9f9f9]">
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">TASK ID</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">CODE FORM NO</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">ATA CODE</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">REFERENCE AMP</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">DESCRIPTION</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">CATEGORY CODE</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">ESTIMATED MAN HOURS</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">IS MANDATORY</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">JSON_Details</TableHead>
                    </TableRow>
                    <TableRow className="border-b border-[#ededed] bg-white">
                      <TableHead className="h-[34px] px-2"><Input value="Filter T" readOnly className="h-7 rounded-none border-[#e7e7e7] px-2 text-[11px] text-[#6a6a6a] shadow-none" /></TableHead>
                      <TableHead className="h-[34px] px-2"><Input value={associatedTaskFilters.codeFormNo} onChange={(event) => setAssociatedTaskFilters((previous) => ({ ...previous, codeFormNo: event.target.value }))} placeholder="Filter C" className="h-7 rounded-none border-[#e7e7e7] px-2 text-[11px] shadow-none" /></TableHead>
                      <TableHead className="h-[34px] px-2"><Input value={associatedTaskFilters.ataCode} onChange={(event) => setAssociatedTaskFilters((previous) => ({ ...previous, ataCode: event.target.value }))} placeholder="Filter A1" className="h-7 rounded-none border-[#e7e7e7] px-2 text-[11px] shadow-none" /></TableHead>
                      <TableHead className="h-[34px] px-2"><Input value={associatedTaskFilters.referenceAmp} onChange={(event) => setAssociatedTaskFilters((previous) => ({ ...previous, referenceAmp: event.target.value }))} placeholder="Filter Reference" className="h-7 rounded-none border-[#e7e7e7] px-2 text-[11px] shadow-none" /></TableHead>
                      <TableHead className="h-[34px] px-2"><Input value={associatedTaskFilters.description} onChange={(event) => setAssociatedTaskFilters((previous) => ({ ...previous, description: event.target.value }))} placeholder="Filter Description" className="h-7 rounded-none border-[#e7e7e7] px-2 text-[11px] shadow-none" /></TableHead>
                      <TableHead className="h-[34px] px-2"><Input value={associatedTaskFilters.categoryCode} onChange={(event) => setAssociatedTaskFilters((previous) => ({ ...previous, categoryCode: event.target.value }))} placeholder="Filter Category" className="h-7 rounded-none border-[#e7e7e7] px-2 text-[11px] shadow-none" /></TableHead>
                      <TableHead className="h-[34px] px-2"><Input value={associatedTaskFilters.estimatedManHours} onChange={(event) => setAssociatedTaskFilters((previous) => ({ ...previous, estimatedManHours: event.target.value }))} placeholder="Filter Hours" className="h-7 rounded-none border-[#e7e7e7] px-2 text-[11px] shadow-none" /></TableHead>
                      <TableHead className="h-[34px] px-2"><Input value={associatedTaskFilters.isMandatory} onChange={(event) => setAssociatedTaskFilters((previous) => ({ ...previous, isMandatory: event.target.value }))} placeholder="true / false" className="h-7 rounded-none border-[#e7e7e7] px-2 text-[11px] shadow-none" /></TableHead>
                      <TableHead className="h-[34px] px-2"><Input value="-" readOnly className="h-7 rounded-none border-[#e7e7e7] px-2 text-[11px] text-[#6a6a6a] shadow-none" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {associatedTemplateTasksLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-[12px] text-[#6a6a6a]">Loading associated task templates…</TableCell>
                      </TableRow>
                    ) : null}
                    {!associatedTemplateTasksLoading && associatedTemplateTasksError ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-[12px] text-destructive">{associatedTemplateTasksError}</TableCell>
                      </TableRow>
                    ) : null}
                    {!associatedTemplateTasksLoading && !associatedTemplateTasksError && filteredAssociatedTemplateTasks.map((task) => (
                      <TableRow key={task.id} className={cn('h-[30px] border-b border-[#f0f0f0]', aircraftWorkPackageSelectedTaskIds.includes(task.id) && 'bg-[#e8f8f8]')}>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.id}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.codeFormNo || '-'}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.ataCode || '-'}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.referenceAmp || '-'}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.description || '-'}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.categoryCode || '-'}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.estimatedManHours || '-'}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.isMandatory ? 'true' : 'false'}</TableCell>
                        <TableCell className="max-w-[260px] px-2 py-1 text-[12px] text-[#5a5a5a]"><div className="max-h-[82px] overflow-auto whitespace-pre-wrap">{task.jsonDetails || '-'}</div></TableCell>
                      </TableRow>
                    ))}
                    {!associatedTemplateTasksLoading && !associatedTemplateTasksError && filteredAssociatedTemplateTasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">No associated task templates found for selected template.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="existing-wp" className="space-y-3 rounded-md border border-[#efefef] bg-white p-4">
              <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-1">
                  <Label htmlFor="aircraft-existing-wp-select" className="text-[12px] font-medium text-[#696969]">Existing work package</Label>
                  <Select value={aircraftSelectedExistingWorkPackageId} onValueChange={setAircraftSelectedExistingWorkPackageId}>
                    <SelectTrigger id="aircraft-existing-wp-select" className="h-8 rounded-none border-[#e7e7e7] bg-white text-[12px] text-[#4f4f4f]">
                      <SelectValue placeholder={aircraftExistingWorkPackagesLoading ? 'Loading work packages...' : 'Choose existing work package'} />
                    </SelectTrigger>
                    <SelectContent>
                      {aircraftExistingWorkPackageList.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {`${item.workPackageNumber} · ${item.title}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {aircraftExistingWorkPackagesError ? <p className="mdm-template-danger">{aircraftExistingWorkPackagesError}</p> : null}
                </div>
                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-none border-[#b6d2d4] text-[11px] text-[#2b8f95]"
                    onClick={handleApplyExistingWorkPackageSelection}
                    disabled={!aircraftSelectedExistingWorkPackageId}
                  >
                    Apply to Form
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto border border-[#e9e9e9]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[#ededed] bg-[#f9f9f9]">
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">WP Number</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">Title</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">Status</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">Type</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">Tasks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aircraftExistingWorkPackageList.map((item) => (
                      <TableRow key={item.id} className={cn('h-[30px] border-b border-[#f0f0f0]', aircraftSelectedExistingWorkPackageId === item.id && 'bg-[#e8f8f8]')}>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{item.workPackageNumber}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{item.title}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{item.status}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{item.maintenanceType}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{item.tasks.length}</TableCell>
                      </TableRow>
                    ))}
                    {!aircraftExistingWorkPackageList.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No existing work packages available for this aircraft.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="non-performed-tasks" className="space-y-3 rounded-md border border-[#efefef] bg-white p-4">
              <div className="overflow-x-auto border border-[#e9e9e9]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[#ededed] bg-[#f9f9f9]">
                      <TableHead className="h-[30px] w-[56px] px-2 text-[12px] font-semibold text-[#4f4f4f]">Select</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">Task number</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">ATA code</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">Description</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">WP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aircraftTaskGridFilteredRows.map((task) => (
                      <TableRow key={task.id} className="h-[30px] border-b border-[#f0f0f0]">
                        <TableCell className="px-2 py-1">
                          <Checkbox
                            aria-label={`Select task ${task.taskNumber || task.id}`}
                            checked={aircraftWorkPackageSelectedTaskIds.includes(task.id)}
                            onCheckedChange={(checked) => handleAircraftWorkPackageTaskSelection(task, Boolean(checked))}
                          />
                        </TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.taskNumber || '-'}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.ataCode || '-'}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.description || '-'}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{('parentWorkPackageNumber' in task ? task.parentWorkPackageNumber : '') || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {!aircraftTaskGridFilteredRows.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No non-performed tasks found.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="all-tasks" className="space-y-3 rounded-md border border-[#efefef] bg-white p-4">
              <div className="overflow-x-auto border border-[#e9e9e9]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[#ededed] bg-[#f9f9f9]">
                      <TableHead className="h-[30px] w-[56px] px-2 text-[12px] font-semibold text-[#4f4f4f]">Select</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">Task number</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">ATA code</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">Description</TableHead>
                      <TableHead className="h-[30px] px-2 text-[12px] font-semibold text-[#4f4f4f]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aircraftTaskGridFilteredRows.map((task) => (
                      <TableRow key={task.id} className="h-[30px] border-b border-[#f0f0f0]">
                        <TableCell className="px-2 py-1">
                          <Checkbox
                            aria-label={`Select task ${task.taskNumber || task.id}`}
                            checked={aircraftWorkPackageSelectedTaskIds.includes(task.id)}
                            onCheckedChange={(checked) => handleAircraftWorkPackageTaskSelection(task, Boolean(checked))}
                          />
                        </TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.taskNumber || '-'}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.ataCode || '-'}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.description || '-'}</TableCell>
                        <TableCell className="px-2 py-1 text-[12px] text-[#5a5a5a]">{task.status}</TableCell>
                      </TableRow>
                    ))}
                    {!aircraftTaskGridFilteredRows.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No tasks available for this aircraft context.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
          <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-[#ececec] bg-white py-2">
            <Button variant="outline" className="h-[26px] rounded-none border-[#b6d2d4] px-4 text-[11px] text-[#2b8f95]" onClick={() => setAircraftWorkPackageDialogOpen(false)} disabled={aircraftWorkPackageSubmitting}>
              Cancel
            </Button>
            <Button
              className="h-[26px] rounded-none bg-[#0ea5a6] px-4 text-[11px] text-white transition-colors hover:bg-[#0d9394]"
              onClick={() => void handleAircraftWorkPackageSubmit('create_open')}
              disabled={aircraftWorkPackageSubmitting || !canCreateWorkPackageFromTemplate}
            >
              {aircraftWorkPackageSubmitting ? 'Creating…' : 'Create New Work Package'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
