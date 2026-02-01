import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, buttonVariants } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { CrudFormLayout } from '@/components/system/CrudFormLayout';
import { FormSection } from '@/components/system/FormSection';
import { DomainService, PlatformDomain } from '@/services/DomainService';
import { ServiceArchitectureService, ServiceCategory, ServiceType } from '@/services/ServiceArchitectureService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, GripVertical, Layers, Truck, AlertCircle, Eye, ClipboardCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { cn } from "@/lib/utils";
import { useDebug } from '@/hooks/useDebug';

const domainSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').regex(/^[a-z0-9_]+$/, 'Code must be lowercase alphanumeric with underscores'),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});

const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').regex(/^[a-z0-9_]+$/, 'Code must be lowercase alphanumeric with underscores'),
  description: z.string().optional(),
  icon_name: z.string().optional(),
  display_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

const typeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').regex(/^[a-z0-9_]+$/, 'Code must be lowercase alphanumeric with underscores'),
  description: z.string().optional(),
  mode_id: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

type DomainFormValues = z.infer<typeof domainSchema>;
type CategoryFormValues = z.infer<typeof categorySchema>;
type TypeFormValues = z.infer<typeof typeSchema>;

export default function PlatformDomainDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const debug = useDebug('Platform', 'DomainAudit');
  const isNew = !id || id === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Hierarchy State
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [categoryTypes, setCategoryTypes] = useState<Record<string, ServiceType[]>>({});
  const [serviceModes, setServiceModes] = useState<{id: string, name: string}[]>([]);
  
  // Dialog States
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ServiceType | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null);
  
  // Services View State
  const [isServicesDialogOpen, setIsServicesDialogOpen] = useState(false);
  const [currentTypeServices, setCurrentTypeServices] = useState<any[]>([]);
  const [viewingType, setViewingType] = useState<ServiceType | null>(null);

  const form = useForm<DomainFormValues>({
    resolver: zodResolver(domainSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      is_active: true,
    },
  });

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      icon_name: '',
      display_order: 0,
      is_active: true,
    },
  });

  const typeForm = useForm<TypeFormValues>({
    resolver: zodResolver(typeSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      mode_id: 'none',
      is_active: true,
    },
  });

  useEffect(() => {
    if (!isNew && id) {
      loadDomain(id);
      loadCategories(id);
      loadServiceModes();
    }
  }, [id, isNew]);

  const loadServiceModes = async () => {
    const { data } = await supabase.from('service_modes').select('id, name').order('name');
    if (data) setServiceModes(data);
  };

  const loadDomain = async (domainId: string) => {
    try {
      const domains = await DomainService.getAllDomains(true);
      const domain = domains.find(d => d.id === domainId);
      
      if (!domain) {
        toast({ title: 'Error', description: 'Domain not found', variant: 'destructive' });
        navigate('/dashboard/settings/domains');
        return;
      }

      form.reset({
        name: domain.name,
        code: domain.code,
        description: domain.description || '',
        is_active: domain.is_active,
      });
    } catch (error) {
      debug.error('Failed to load domain', error);
      toast({ title: 'Error', description: 'Failed to load domain details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async (domainId: string) => {
    try {
      const data = await ServiceArchitectureService.getCategoriesByDomain(domainId);
      setCategories(data);
      // Pre-load types for all categories to have a smooth experience? 
      // Or lazy load. Let's lazy load or just load all for now as there won't be thousands.
      // Actually, let's just load them when we need them or iterate and load.
      // For simplicity in this view, let's load all types for these categories.
      data.forEach(cat => loadTypes(cat.id));
    } catch (error) {
      debug.error('Failed to load categories', error);
    }
  };

  const loadTypes = async (categoryId: string) => {
    try {
      const data = await ServiceArchitectureService.getTypesByCategory(categoryId);
      setCategoryTypes(prev => ({ ...prev, [categoryId]: data }));
    } catch (error) {
      debug.error('Failed to load types', error);
    }
  };

  const onViewServices = async (type: ServiceType) => {
    try {
      setViewingType(type);
      const services = await ServiceArchitectureService.getServicesByType(type.id);
      setCurrentTypeServices(services);
      setIsServicesDialogOpen(true);
    } catch (error) {
      debug.error('Failed to load services', error);
      toast({ title: 'Error', description: 'Failed to load linked services', variant: 'destructive' });
    }
  };

  const onCategorySubmit = async (values: CategoryFormValues) => {
    if (!id) return;
    try {
      if (editingCategory) {
        await ServiceArchitectureService.updateCategory(editingCategory.id, {
          ...values,
          description: values.description || null,
          icon_name: values.icon_name || null,
        });
        toast({ title: 'Success', description: 'Category updated' });
      } else {
        await ServiceArchitectureService.createCategory({
          name: values.name,
          code: values.code,
          is_active: values.is_active,
          display_order: values.display_order,
          domain_id: id,
          description: values.description || null,
          icon_name: values.icon_name || null,
        });
        toast({ title: 'Success', description: 'Category created' });
      }
      setIsCategoryDialogOpen(false);
      loadCategories(id);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const onDeleteCategory = async (categoryId: string) => {
    try {
      await ServiceArchitectureService.deleteCategory(categoryId);
      toast({ title: 'Success', description: 'Category deleted' });
      if (id) loadCategories(id);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const onTypeSubmit = async (values: TypeFormValues) => {
    if (!targetCategoryId) return;
    try {
      const payload = {
        name: values.name,
        code: values.code,
        description: values.description || null,
        is_active: values.is_active,
        mode_id: values.mode_id === 'none' ? null : values.mode_id,
        category_id: targetCategoryId,
      };

      if (editingType) {
        await ServiceArchitectureService.updateType(editingType.id, payload);
        toast({ title: 'Success', description: 'Service type updated' });
      } else {
        await ServiceArchitectureService.createType(payload);
        toast({ title: 'Success', description: 'Service type created' });
      }
      setIsTypeDialogOpen(false);
      loadTypes(targetCategoryId);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const onDeleteType = async (typeId: string, categoryId: string) => {
    try {
      await ServiceArchitectureService.deleteType(typeId);
      toast({ title: 'Success', description: 'Service type deleted' });
      loadTypes(categoryId);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const openCategoryDialog = (category?: ServiceCategory) => {
    if (category) {
      setEditingCategory(category);
      categoryForm.reset({
        name: category.name,
        code: category.code,
        description: category.description || '',
        icon_name: category.icon_name || '',
        display_order: category.display_order,
        is_active: category.is_active,
      });
    } else {
      setEditingCategory(null);
      categoryForm.reset({
        name: '',
        code: '',
        description: '',
        icon_name: '',
        display_order: 0,
        is_active: true,
      });
    }
    setIsCategoryDialogOpen(true);
  };

  const openTypeDialog = (categoryId: string, type?: ServiceType) => {
    setTargetCategoryId(categoryId);
    if (type) {
      setEditingType(type);
      typeForm.reset({
        name: type.name,
        code: type.code,
        description: type.description || '',
        mode_id: type.mode_id || 'none',
        is_active: type.is_active,
      });
    } else {
      setEditingType(null);
      typeForm.reset({
        name: '',
        code: '',
        description: '',
        mode_id: 'none',
        is_active: true,
      });
    }
    setIsTypeDialogOpen(true);
  };

  const onSubmit = async (values: DomainFormValues) => {
    try {
      if (isNew) {
        // Zod schema ensures values are strings, but we need to explicitly type them for createDomain
        await DomainService.createDomain({
          name: values.name,
          code: values.code,
          description: values.description,
          is_active: values.is_active
        });
        toast({ title: 'Success', description: 'Domain created successfully' });
      } else if (id) {
        await DomainService.updateDomain(id, values);
        toast({ title: 'Success', description: 'Domain updated successfully' });
      }
      navigate('/dashboard/settings/domains');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await DomainService.deleteDomain(id);
      toast({ title: 'Success', description: 'Domain deleted successfully' });
      navigate('/dashboard/settings/domains');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const runHierarchyAudit = () => {
    debug.group('🔍 Service Hierarchy Audit');
    debug.log(`Domain ID: ${id}`);
    debug.log(`Total Categories: ${categories.length}`);
    
    let issuesFound = 0;
    const auditResults: string[] = [];

    if (categories.length === 0) {
      debug.warn('⚠️ No categories found for this domain.');
      auditResults.push('No categories found.');
      issuesFound++;
    }

    categories.forEach(cat => {
      debug.group(`Category: ${cat.name} (${cat.code})`);
      const types = categoryTypes[cat.id] || [];
      debug.log(`Types: ${types.length}`);
      
      if (types.length === 0) {
        debug.warn('⚠️ Category has no service types.');
        auditResults.push(`Category "${cat.name}" is empty.`);
        issuesFound++;
      }

      types.forEach(type => {
        if (type.mode_id && !serviceModes.find(m => m.id === type.mode_id)) {
          debug.error(`❌ Type "${type.name}" references unknown mode ID: ${type.mode_id}`);
          auditResults.push(`Type "${type.name}" has invalid mode reference.`);
          issuesFound++;
        }
      });
      debug.groupEnd();
    });

    debug.groupEnd();

    if (issuesFound > 0) {
      toast({ 
        title: `Audit Completed: ${issuesFound} Issues Found`, 
        description: (
          <div className="mt-2 text-xs">
            <ul className="list-disc pl-4">
              {auditResults.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        ),
        variant: 'destructive' 
      });
    } else {
      toast({ title: 'Audit Passed', description: 'Hierarchy structure appears valid.', variant: 'default' });
    }
  };

  if (loading) {
    return <DashboardLayout><div>Loading...</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <CrudFormLayout
        title={isNew ? 'New Platform Domain' : 'Edit Platform Domain'}
        description={isNew ? 'Create a new business domain' : 'Update existing business domain details'}
        onSave={form.handleSubmit(onSubmit)}
        onCancel={() => navigate('/dashboard/settings/domains')}
        footerExtra={!isNew && (
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            Delete
          </Button>
        )}
        saveDisabled={!form.formState.isValid || !form.formState.isDirty}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormSection title="General Information" description="Basic details about the business domain">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Logistics & Freight" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. logistics" {...field} disabled={!isNew} />
                      </FormControl>
                      <FormDescription>Unique identifier used in system logic (cannot be changed later)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe the purpose of this domain..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active Status</FormLabel>
                        <FormDescription>
                          Disable to hide this domain from new selections
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>

            {!isNew && (
              <div className="space-y-6 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Service Architecture</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage service categories and types for this domain
                    </p>
                  </div>
                  <Button type="button" onClick={runHierarchyAudit} variant="outline" size="sm" className="mr-2">
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Audit Hierarchy
                  </Button>
                  <Button type="button" onClick={() => openCategoryDialog()} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </div>

                {categories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                    <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No service categories defined</p>
                    <Button variant="link" onClick={() => openCategoryDialog()}>
                      Create your first category
                    </Button>
                  </div>
                ) : (
                  <Accordion type="single" collapsible className="w-full border rounded-lg">
                    {categories.map((category) => (
                      <AccordionItem key={category.id} value={category.id} className="px-4">
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-4 flex-1 text-left">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{category.name}</span>
                                <Badge variant="outline" className="font-mono text-xs">{category.code}</Badge>
                                {!category.is_active && <Badge variant="secondary">Inactive</Badge>}
                              </div>
                              {category.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{category.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mr-4" onClick={(e) => e.stopPropagation()}>
                              <div
                                role="button"
                                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 cursor-pointer")}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  openCategoryDialog(category);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </div>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <div 
                                    role="button"
                                    className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 text-destructive hover:text-destructive cursor-pointer")}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </div>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete "{category.name}" and all its associated service types. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onDeleteCategory(category.id)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-6">
                          <div className="pl-8 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-muted-foreground">Service Types</h4>
                              <Button type="button" variant="outline" size="sm" onClick={() => openTypeDialog(category.id)}>
                                <Plus className="h-3 w-3 mr-2" />
                                Add Type
                              </Button>
                            </div>

                            {!categoryTypes[category.id] || categoryTypes[category.id].length === 0 ? (
                              <div className="text-sm text-muted-foreground italic py-2">
                                No service types defined for this category.
                              </div>
                            ) : (
                              <div className="grid gap-2">
                                {categoryTypes[category.id].map((type) => (
                                  <div key={type.id} className="flex items-center justify-between p-3 rounded-md border bg-card/50 hover:bg-card transition-colors">
                                    <div className="flex items-center gap-3">
                                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Truck className="h-4 w-4 text-primary" />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm">{type.name}</span>
                                          <Badge variant="secondary" className="font-mono text-[10px]">{type.code}</Badge>
                                          {!type.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            {type.mode_id && (
                                                <Badge variant="outline" className="text-[10px] bg-muted/50">
                                                    {serviceModes.find(m => m.id === type.mode_id)?.name || 'Unknown Mode'}
                                                </Badge>
                                            )}
                                            {type.description && (
                                                <span className="text-xs text-muted-foreground line-clamp-1">{type.description}</span>
                                            )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewServices(type)} title="View Linked Services">
                                        <Eye className="h-3 w-3" />
                                      </Button>
                                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openTypeDialog(category.id, type)}>
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Service Type?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              This will permanently delete "{type.name}". This action cannot be undone.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onDeleteType(type.id, category.id)}>
                                              Delete
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            )}
          </form>
        </Form>

        <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Edit Category' : 'New Category'}</DialogTitle>
              <DialogDescription>
                {editingCategory ? 'Update service category details' : 'Create a new service category for this domain'}
              </DialogDescription>
            </DialogHeader>
            <Form {...categoryForm}>
              <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4">
                <FormField
                  control={categoryForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Transportation" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={categoryForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. transportation" {...field} disabled={!!editingCategory} />
                      </FormControl>
                      <FormDescription>Unique identifier (cannot be changed)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={categoryForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Category description..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={categoryForm.control}
                    name="display_order"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Order</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={categoryForm.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Status</FormLabel>
                        <div className="flex items-center gap-2 border rounded-md p-2">
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                          <span className="text-sm text-muted-foreground">{field.value ? 'Active' : 'Inactive'}</span>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Save Category</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingType ? 'Edit Service Type' : 'New Service Type'}</DialogTitle>
              <DialogDescription>
                {editingType ? 'Update service type details' : 'Create a new service type for this category'}
              </DialogDescription>
            </DialogHeader>
            <Form {...typeForm}>
              <form onSubmit={typeForm.handleSubmit(onTypeSubmit)} className="space-y-4">
                <FormField
                  control={typeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Ocean Freight" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={typeForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. ocean_freight" {...field} disabled={!!editingType} />
                      </FormControl>
                      <FormDescription>Unique identifier (cannot be changed)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={typeForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Type description..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={typeForm.control}
                  name="mode_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transport Mode</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value || 'none'}
                        value={field.value || 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a mode (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {serviceModes.map(mode => (
                            <SelectItem key={mode.id} value={mode.id}>
                              {mode.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Link to a transport mode if applicable</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={typeForm.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel>Status</FormLabel>
                      <div className="flex items-center gap-2 border rounded-md p-2">
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                        <span className="text-sm text-muted-foreground">{field.value ? 'Active' : 'Inactive'}</span>
                      </div>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">Save Service Type</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isServicesDialogOpen} onOpenChange={setIsServicesDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Linked Services: {viewingType?.name}</DialogTitle>
              <DialogDescription>
                Services currently using this service type.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {currentTypeServices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <p>No services found linked to this type.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Service Name</th>
                        <th className="px-4 py-2 text-left font-medium">Code</th>
                        <th className="px-4 py-2 text-left font-medium">Base Price</th>
                        <th className="px-4 py-2 text-left font-medium">Status</th>
                        <th className="px-4 py-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {currentTypeServices.map((service) => (
                        <tr key={service.id} className="hover:bg-muted/50">
                          <td className="px-4 py-2 font-medium">{service.service_name}</td>
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{service.service_code || '-'}</td>
                          <td className="px-4 py-2">
                            {service.base_price ? `${service.base_price} ${service.pricing_unit || ''}` : '-'}
                          </td>
                          <td className="px-4 py-2">
                            {service.is_active ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">Inactive</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                             <Button variant="link" size="sm" className="h-auto p-0" onClick={() => {
                               setIsServicesDialogOpen(false);
                               navigate('/dashboard/services');
                             }}>
                               View
                             </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setIsServicesDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </CrudFormLayout>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the domain
              and potentially break any tenants referencing it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
