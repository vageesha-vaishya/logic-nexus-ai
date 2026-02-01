import React, { useState, useEffect, useMemo } from 'react';
import { Upload, Download, Search, Plus, Edit2, Trash2, Save, X, Filter, FileSpreadsheet, Database, RefreshCw, Info, CloudCog } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { ActionsToolbar } from '@/components/ui/ActionsToolbar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { parseFileRows, exportCsv, exportExcel, exportJsonTemplate, downloadErrorsCsv, exportJson } from '@/lib/import-export';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDebug } from '@/hooks/useDebug';

type CodeRecord = {
  id?: string;
  hts_code: string;
  schedule_b?: string;
  category: string;
  sub_category?: string;
  sub_sub_category?: string;
  description: string;
  uom1?: string;
  uom2?: string;
  duty_rate?: string;
  special_provisions?: string;
  created_at?: string;
  updated_at?: string;
};

// Form state for add/edit (exclude id and timestamps)
type FormData = Omit<CodeRecord, 'id' | 'created_at' | 'updated_at'>;

// Supabase configuration UI removed — using app's default client

// Main Application Component
const AESHTSCodeManager: React.FC = () => {
  const { scopedDb } = useCRM();
  const debug = useDebug('Compliance', 'HTSManager');
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [codes, setCodes] = useState<CodeRecord[]>([]);
  const [filteredCodes, setFilteredCodes] = useState<CodeRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'add' | 'import'>('browse');
  const [importErrors, setImportErrors] = useState<Array<{
    row: number;
    hts_code?: string;
    category?: string;
    description?: string;
    uom1?: string;
    uom2?: string;
    duty_rate?: string;
    hts_code_error?: string;
    category_error?: string;
    description_error?: string;
    uom1_error?: string;
    uom2_error?: string;
    duty_rate_error?: string;
  }>>([]);
  const [showErrorTable, setShowErrorTable] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const handleSync = async () => {
    // Check Auth first
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please log in to synchronize HTS codes.");
      return;
    }

    if (!confirm("This will synchronize HTS codes with the US Census Bureau. This operation may take a minute. Continue?")) return;
    
    setIsSyncing(true);
    const toastId = toast.loading("Synchronizing with Census Bureau...");
    
    try {
        // Try invoking the function via Supabase client
        const { data, error } = await supabase.functions.invoke('sync-hts-data');
        
        if (error) {
           debug.warn("Supabase invoke failed, trying direct fetch fallback...", { error });
           throw error; // Throw to catch block to try fallback
        }
        
        if (data && !data.success) throw new Error(data.error || 'Sync failed');
        
        toast.dismiss(toastId);
        toast.success(`Sync Complete: ${data.message || 'Data updated'}`);
        await loadCodes();
    } catch (err: any) {
        debug.error("Sync error details:", err);
        
        // Fallback: Direct Fetch
        try {
            const baseUrl = import.meta.env.VITE_SUPABASE_URL || '';
            const functionUrl = `${baseUrl.replace(/\/$/, '')}/functions/v1/sync-hts-data`;
            
            debug.log("Attempting fallback fetch to:", functionUrl);
            
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Fallback failed: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Sync failed');
            
            toast.dismiss(toastId);
            toast.success(`Sync Complete: ${data.message || 'Data updated'}`);
            await loadCodes();
            
        } catch (fallbackErr: any) {
             debug.error("Fallback sync error:", fallbackErr);
             toast.dismiss(toastId);
             
             let errorMessage = fallbackErr.message || "Unknown error";
             if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
                 errorMessage = "Edge Function unreachable. Check your network connection or CORS configuration.";
             }
             
             toast.error(`Sync Failed: ${errorMessage}`);
        }
    } finally {
        setIsSyncing(false);
    }
  };
  
  const [formData, setFormData] = useState<FormData>({
    hts_code: '',
    schedule_b: '',
    category: '',
    sub_category: '',
    sub_sub_category: '',
    description: '',
    uom1: '',
    uom2: '',
    duty_rate: '',
    special_provisions: ''
  });

  const importInputRef = React.useRef<HTMLInputElement | null>(null);
  const expectedHeaders = [
    'hts_code',
    'schedule_b',
    'category',
    'sub_category',
    'sub_sub_category',
    'description',
    'uom1',
    'uom2',
    'duty_rate',
    'special_provisions',
  ];

  // Predefined valid Units of Measure used across the app
  const VALID_UOMS: string[] = [
    'Number', 'Kilograms', 'Grams', 'Pounds', 'Ounces', 'Pieces', 'Each', 'Dozen', 'Set',
    'Meters', 'Centimeters', 'Inches', 'Liters', 'Milliliters', 'Gallons', 'Square Meters', 'Cubic Meters',
    'Pairs', 'Square Feet'
  ];

  // Initialize Supabase: use the application's default supabase client
  useEffect(() => {
    setIsConnected(true);
    loadCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedDb]);

  // Table creation helper removed — migrations handle schema

  // Load codes from Supabase
  const loadCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await scopedDb
        .from('aes_hts_codes', true)
        .select('*')
        .order('hts_code', { ascending: true });
      
      if (error) throw error;
      
      setCodes(data || []);
      setFilteredCodes(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      debug.error('Error loading codes:', err);
      // If table doesn't exist, use sample data
      if (typeof message === 'string' && message.includes('relation')) {
        const sampleData = generateSampleData();
        setCodes(sampleData);
        setFilteredCodes(sampleData);
      }
    } finally {
      setLoading(false);
    }
  };

  // Generate sample data for demonstration
  const generateSampleData = (): CodeRecord[] => {
    return [
      {
        id: '1',
        hts_code: '8802.11.00.30',
        schedule_b: '8802.11.0030',
        category: 'Aircraft, spacecraft, and parts thereof',
        sub_category: 'Helicopters',
        sub_sub_category: 'Unladen weight not exceeding 998 kg',
        description: 'Helicopters with an unladen weight not exceeding 998 kg',
        uom1: 'Number',
        uom2: '',
        duty_rate: 'Free',
        special_provisions: 'License may be required'
      },
      {
        id: '2',
        hts_code: '8802.12.00.40',
        schedule_b: '8802.12.0040',
        category: 'Aircraft, spacecraft, and parts thereof',
        sub_category: 'Helicopters',
        sub_sub_category: 'Unladen weight exceeding 998 kg',
        description: 'Helicopters with an unladen weight exceeding 998 kg',
        uom1: 'Number',
        uom2: '',
        duty_rate: 'Free',
        special_provisions: 'License may be required'
      },
      {
        id: '3',
        hts_code: '8471.30.01.00',
        schedule_b: '8471.30.0100',
        category: 'Electronic integrated circuits and microassemblies',
        sub_category: 'Portable automatic data processing machines',
        sub_sub_category: 'Weighing not more than 10 kg',
        description: 'Portable automatic data processing machines, weighing not more than 10 kg, consisting of at least a central processing unit, a keyboard and a display',
        uom1: 'Number',
        uom2: '',
        duty_rate: 'Free',
        special_provisions: 'FCC approval required'
      }
    ];
  };

  // Search and filter functionality
  useEffect(() => {
    let result = codes;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(code =>
        code.hts_code.toLowerCase().includes(search) ||
        code.schedule_b?.toLowerCase().includes(search) ||
        code.description.toLowerCase().includes(search) ||
        code.category.toLowerCase().includes(search)
      );
    }

    if (categoryFilter) {
      result = result.filter(code => code.category === categoryFilter);
    }

    if (subCategoryFilter) {
      result = result.filter(code => code.sub_category === subCategoryFilter);
    }

    setFilteredCodes(result);
  }, [searchTerm, categoryFilter, subCategoryFilter, codes]);

  // Get unique categories and subcategories
  const categories = useMemo(() => [...new Set(codes.map((c) => c.category))].filter(Boolean), [codes]);
  const subCategories = useMemo(
    () =>
      [...new Set(codes.filter((c) => !categoryFilter || c.category === categoryFilter).map((c) => c.sub_category))].filter(
        Boolean
      ),
    [codes, categoryFilter]
  );

  // CRUD Operations
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);
    try {
      // Basic validation for required fields
      const required: Array<[string, string]> = [
        ['hts_code', formData.hts_code?.trim() || ''],
        ['category', formData.category?.trim() || ''],
        ['description', formData.description?.trim() || ''],
      ];
      for (const [field, value] of required) {
        if (!value) throw new Error(`Missing required field: ${field}`);
      }
      const u1 = (formData.uom1 || '').trim();
      const u2 = (formData.uom2 || '').trim();
      if (!u1) throw new Error('UOM1 (Primary Unit) is required');
      if (!VALID_UOMS.includes(u1)) throw new Error('UOM1 must be a valid unit of measure');
      if (u2 && !VALID_UOMS.includes(u2)) throw new Error('UOM2 must be a valid unit of measure');

      if (isEditing) {
        if (!editingId) {
          throw new Error('Missing record id for update');
        }
        const { error } = await scopedDb
          .from('aes_hts_codes', true)
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await scopedDb
          .from('aes_hts_codes', true)
          .insert([formData]);

        if (error) throw error;
      }
      
      await loadCodes();
      resetForm();
      setActiveTab('browse');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      debug.error('Error saving code:', err);
      alert('Error saving code: ' + message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (code: CodeRecord) => {
    setFormData({
      hts_code: code.hts_code,
      schedule_b: code.schedule_b ?? '',
      category: code.category,
      sub_category: code.sub_category ?? '',
      sub_sub_category: code.sub_sub_category ?? '',
      description: code.description,
      uom1: code.uom1 ?? '',
      uom2: code.uom2 ?? '',
      duty_rate: code.duty_rate ?? '',
      special_provisions: code.special_provisions ?? ''
    });
    setIsEditing(true);
    setEditingId(code.id ?? null);
    setActiveTab('add');
  };

  const handleDelete = async (id: string | undefined) => {
    if (!confirm('Are you sure you want to delete this code?')) return;
    
    if (!id) return;

    setLoading(true);
    try {
      const { error } = await scopedDb
        .from('aes_hts_codes', true)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      await loadCodes();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      debug.error('Error deleting code:', err);
      alert('Error deleting code: ' + message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      hts_code: '',
      schedule_b: '',
      category: '',
      sub_category: '',
      sub_sub_category: '',
      description: '',
      uom1: '',
      uom2: '',
      duty_rate: '',
      special_provisions: ''
    });
    setIsEditing(false);
    setEditingId(null);
  };

  // Excel/CSV Import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target as HTMLInputElement;
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const rows = await parseFileRows(file);
      if (!rows.length) throw new Error('No rows found in file');

      const headerRaw = rows[0];
      const headers = headerRaw.map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_'));

      const missing = expectedHeaders.filter(h => !headers.includes(h));
      if (missing.length) {
        alert(`Missing required columns: ${missing.join(', ')}`);
        downloadErrorsCsv('hts-import-missing-headers.csv', ['missing_headers'], [{ missing_headers: missing.join('|') }]);
        return;
      }

      const dataRows = rows.slice(1).filter(r => r.some(v => v && String(v).trim().length));
      const importedData = dataRows.map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = (row[i] !== undefined ? String(row[i]).trim() : '') || '';
        });
        return obj;
      });

      // Build sanitized rows from imported data
      const sanitized = importedData.map((d) => ({
          hts_code: d['hts_code'] || '',
          schedule_b: d['schedule_b'] || '',
          category: d['category'] || '',
          sub_category: d['sub_category'] || '',
          sub_sub_category: d['sub_sub_category'] || '',
          description: d['description'] || '',
          uom1: d['uom1'] || '',
          uom2: d['uom2'] || '',
          duty_rate: d['duty_rate'] || '',
          special_provisions: d['special_provisions'] || ''
      }));

      // Row-level validation
      const htsRegex = /^\d{4}(?:\.\d{2}){0,3}$/;
      const allowedUOM = new Set<string>(VALID_UOMS.map(v => v.toLowerCase()));
      const errors: Array<{row: number;
        hts_code?: string; category?: string; description?: string; uom1?: string; uom2?: string; duty_rate?: string;
        hts_code_error?: string; category_error?: string; description_error?: string; uom1_error?: string; uom2_error?: string; duty_rate_error?: string
      }> = [];

      // Query live codes from Supabase right before import to avoid race conditions
      let existingSet = new Set<string>((codes || []).map(c => (c.hts_code || '').trim()));
      try {
        const { data, error } = await scopedDb.from('aes_hts_codes', true).select('hts_code');
        if (error) {
          debug.warn('Failed to fetch live codes before import, using cached list:', error.message);
        } else if (data) {
          existingSet = new Set<string>((data as Array<{ hts_code: string }>).map(d => (d.hts_code || '').trim()));
        }
      } catch (fetchErr) {
        debug.warn('Error while fetching live codes before import:', fetchErr);
      }
      const seenSet = new Set<string>();
      const validSanitized = sanitized.filter((r, idx) => {
        const rowNum = idx + 2; // +1 for zero-index, +1 for header row
        const htsIssues: string[] = [];
        const categoryIssues: string[] = [];
        const descriptionIssues: string[] = [];
        const uom1Issues: string[] = [];
        const uom2Issues: string[] = [];
        const dutyIssues: string[] = [];

        const code = (r.hts_code || '').trim();
        if (!code) htsIssues.push('missing');
        else {
          if (!htsRegex.test(code)) htsIssues.push('malformed');
          if (seenSet.has(code)) htsIssues.push('duplicate_in_file');
          if (existingSet.has(code)) htsIssues.push('duplicate_existing');
        }
        if (!r.category) categoryIssues.push('missing');
        if (!r.description) descriptionIssues.push('missing');

        // uom1 constrained list (if provided)
        const uom1 = (r.uom1 || '').trim();
        if (uom1) {
          if (!allowedUOM.has(uom1.toLowerCase())) {
            uom1Issues.push('invalid_value');
          }
        }

        // uom2 constrained list (if provided)
        const uom2 = (r.uom2 || '').trim();
        if (uom2) {
          if (!allowedUOM.has(uom2.toLowerCase())) {
            uom2Issues.push('invalid_value');
          }
        }

        // duty_rate numeric-only (allow decimals and optional trailing %)
        const duty = (r.duty_rate || '').trim();
        if (duty) {
          const dutyRegex = /^\d+(?:\.\d+)?%?$/;
          if (!dutyRegex.test(duty)) {
            dutyIssues.push('non_numeric');
          }
        }

        if (htsIssues.length || categoryIssues.length || descriptionIssues.length || uom1Issues.length || uom2Issues.length || dutyIssues.length) {
          errors.push({
            row: rowNum,
            hts_code: r.hts_code,
            category: r.category,
            description: r.description,
            uom1: r.uom1,
            uom2: r.uom2,
            duty_rate: r.duty_rate,
            hts_code_error: htsIssues.join('|') || undefined,
            category_error: categoryIssues.join('|') || undefined,
            description_error: descriptionIssues.join('|') || undefined,
            uom1_error: uom1Issues.join('|') || undefined,
            uom2_error: uom2Issues.join('|') || undefined,
            duty_rate_error: dutyIssues.join('|') || undefined,
          });
          return false;
        }
        if (code) seenSet.add(code);
        return true;
      });
      setImportErrors(errors);

      if (!validSanitized.length) {
        alert('No valid rows to import. Please review and download the errors CSV.');
      } else {
        const { error } = await scopedDb.from('aes_hts_codes', true).insert(validSanitized);
        if (error) throw error;
        await loadCodes();
        alert(`Imported ${validSanitized.length} valid records${errors.length ? `; ${errors.length} rows failed validation` : ''}.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      debug.error('Import error:', err);
      alert('Error importing file: ' + message);
    } finally {
      setLoading(false);
      if (importInputRef.current) importInputRef.current.value = '';
      inputEl.value = '';
    }
  };

  // Excel/CSV Export
  const handleExport = () => {
    const headers = expectedHeaders;
    exportCsv(`aes-hts-codes-${new Date().toISOString().split('T')[0]}.csv`, headers, filteredCodes);
  };

  // Seed sample data to Supabase
  const seedDatabase = async () => {
    const client = scopedDb;

    if (!confirm('This will add sample HTS/Schedule B codes to your database. Continue?')) return;

    setLoading(true);
    try {
      const sampleData = [
        ...generateSampleData(),
        {
          hts_code: '0201.10.00.00',
          schedule_b: '0201.10.0000',
          category: 'Meat and edible meat offal',
          sub_category: 'Meat of bovine animals, fresh or chilled',
          sub_sub_category: 'Carcasses and half-carcasses',
          description: 'Carcasses and half-carcasses of bovine animals, fresh or chilled',
          uom1: 'Kilograms',
          uom2: '',
          duty_rate: '4.4¢/kg',
          special_provisions: 'Subject to quota'
        },
        {
          hts_code: '6203.41.18.10',
          schedule_b: '6203.41.1810',
          category: 'Articles of apparel and clothing accessories',
          sub_category: 'Men\'s or boys\' trousers and shorts',
          sub_sub_category: 'Of wool or fine animal hair',
          description: 'Men\'s or boys\' trousers, breeches and shorts of wool or fine animal hair',
          uom1: 'Dozen',
          uom2: 'Pieces',
          duty_rate: '16.2%',
          special_provisions: 'Category 347'
        }
      ];

      const sanitized = sampleData.map(({ id, created_at, updated_at, ...rest }) => rest);
      const { error } = await client
        .from('aes_hts_codes')
        .insert(sanitized);
      
      if (error) throw error;
      
      await loadCodes();
      alert(`Successfully seeded ${sanitized.length} sample records`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      debug.error('Seed error:', err);
      alert('Error seeding database: ' + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                AES HTS/Schedule B Code Manager
              </h1>
              <p className="text-gray-600 mb-4">
                Comprehensive management system for Automated Export System filing
              </p>
              <div className="flex items-center gap-4">
                {isSyncing && (
                    <div className="flex flex-col items-end min-w-[150px]">
                        <span className="text-xs text-blue-600 animate-pulse mb-1 font-medium">Processing...</span>
                        <Progress value={undefined} className="h-2 w-full" />
                    </div>
                )}
                <Button 
                  onClick={handleSync} 
                  disabled={isSyncing} 
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                  <CloudCog className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? "Synchronizing..." : "Sync with Census"}
                </Button>
              </div>
            </div>
            <FileSpreadsheet className="w-16 h-16 text-blue-600" />
          </div>
          
          {/* Supabase connection UI removed to avoid confusion; using default client */}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('browse')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === 'browse'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Search className="w-5 h-5 inline mr-2" />
              Browse & Search
            </button>
            <button
              onClick={() => {
                setActiveTab('add');
                resetForm();
              }}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === 'add'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Plus className="w-5 h-5 inline mr-2" />
              Add/Edit Code
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === 'import'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Upload className="w-5 h-5 inline mr-2" />
              Import/Export
            </button>
          </div>
        </div>

        {/* Browse & Search Tab */}
        {activeTab === 'browse' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="md:col-span-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by HTS Code, Schedule B, or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <select
                    value={subCategoryFilter}
                    onChange={(e) => setSubCategoryFilter(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!categoryFilter}
                  >
                    <option value="">All Sub-Categories</option>
                    {subCategories.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setCategoryFilter('');
                      setSubCategoryFilter('');
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Clear Filters
                  </button>
                  <button
                    onClick={handleExport}
                    className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Export
                  </button>
                </div>
              </div>
              
              <div className="text-sm text-gray-600">
                Showing {filteredCodes.length} of {codes.length} codes
              </div>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">HTS Code</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Schedule B</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Category</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Description</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                          <p className="text-gray-600">Loading codes...</p>
                        </td>
                      </tr>
                    ) : filteredCodes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          No codes found. Try adjusting your filters or add new codes.
                        </td>
                      </tr>
                    ) : (
                      filteredCodes.map((code) => (
                        <tr key={code.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm font-medium text-blue-600">
                              {code.hts_code}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm text-gray-600">
                              {code.schedule_b || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">{code.category}</div>
                              {code.sub_category && (
                                <div className="text-gray-600 text-xs mt-1">{code.sub_category}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-700 max-w-md">
                              {code.description.substring(0, 100)}
                              {code.description.length > 100 && '...'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(code)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(code.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Tab */}
        {activeTab === 'add' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {isEditing ? 'Edit HTS/Schedule B Code' : 'Add New HTS/Schedule B Code'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    HTS Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.hts_code}
                    onChange={(e) => setFormData({ ...formData, hts_code: e.target.value })}
                    placeholder="8802.11.00.30"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Format: XXXX.XX.XX.XX (up to 10 digits)</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule B Code
                  </label>
                  <input
                    type="text"
                    value={formData.schedule_b}
                    onChange={(e) => setFormData({ ...formData, schedule_b: e.target.value })}
                    placeholder="8802.11.0030"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Aircraft, spacecraft, and parts thereof"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sub-Category
                  </label>
                  <input
                    type="text"
                    value={formData.sub_category}
                    onChange={(e) => setFormData({ ...formData, sub_category: e.target.value })}
                    placeholder="Helicopters"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sub-Sub-Category
                  </label>
                  <input
                    type="text"
                    value={formData.sub_sub_category}
                    onChange={(e) => setFormData({ ...formData, sub_sub_category: e.target.value })}
                    placeholder="Unladen weight not exceeding 998 kg"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Helicopters with an unladen weight not exceeding 998 kg"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    UOM1 (Primary Unit) *
                  </label>
                  <Select value={formData.uom1 || ''} onValueChange={(v) => setFormData({ ...formData, uom1: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {VALID_UOMS.map((u) => (
                        <SelectItem key={`uom1-${u}`} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-gray-500">First Unit of Measurement for AES filing</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    UOM2 (Secondary Unit)
                  </label>
                  <Select
                    value={(formData.uom2 ?? '') === '' ? '__none__' : (formData.uom2 as string)}
                    onValueChange={(v) => setFormData({ ...formData, uom2: v === '__none__' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional: select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {VALID_UOMS.map((u) => (
                        <SelectItem key={`uom2-${u}`} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-gray-500">Second Unit of Measurement for AES filing (optional)</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duty Rate
                  </label>
                  <input
                    type="text"
                    value={formData.duty_rate}
                    onChange={(e) => setFormData({ ...formData, duty_rate: e.target.value })}
                    placeholder="Free, 4.4¢/kg, 16.2%"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special Provisions
                  </label>
                  <input
                    type="text"
                    value={formData.special_provisions}
                    onChange={(e) => setFormData({ ...formData, special_provisions: e.target.value })}
                    placeholder="License may be required"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-5 h-5" />
                  {loading ? 'Saving...' : (isEditing ? 'Update Code' : 'Add Code')}
                </button>
                
                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Import/Export Tab */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Import Data</h2>
              <p className="text-gray-600 mb-6">
                Upload a CSV/Excel file with HTS/Schedule B codes. Headers must match the expected columns.
              </p>

              <ActionsToolbar className="mb-4" label="Import" labelVariant="outline">
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleImport}
                  className="hidden"
                />
                <Button variant="outline" onClick={() => importInputRef.current?.click()} disabled={loading}>
                  <Upload className="w-4 h-4 mr-2" />
                  Import CSV/Excel
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" title="Import help">
                      <Info className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[520px]">
                    <div className="space-y-3">
                      <div>
                        <div className="font-semibold">Expected Columns</div>
                        <div className="text-xs text-muted-foreground">
                          {expectedHeaders.join(', ')}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold">Sample CSV</div>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{`hts_code,schedule_b,category,sub_category,sub_sub_category,description,unit_of_measure,duty_rate,special_provisions
8802.11.00.30,8802.11.0030,Aircraft spacecraft and parts thereof,Helicopters,Unladen weight not exceeding 998 kg,Helicopters with an unladen weight not exceeding 998 kg,Number,Free,License may be required`}</pre>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => exportCsv('hts-template.csv', expectedHeaders, [])}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download CSV Template
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => exportExcel('hts-template.xlsx', expectedHeaders, [])}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download XLSX Template
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => exportJsonTemplate('hts-template.json', expectedHeaders)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download JSON Template
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </ActionsToolbar>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-500">
                  Use the "Import CSV/Excel" button above to select a file.
                </p>
                <p className="text-xs text-gray-500 mt-2">Supported formats: CSV, Excel (.xlsx, .xls)</p>
              </div>

              {importErrors.length > 0 && (
                <div className="mt-4">
                  <ActionsToolbar label="Errors" labelVariant="destructive">
                    <div className="text-sm text-red-600 mr-2">{importErrors.length} row(s) failed validation or duplicate checks</div>
                    <Button
                      variant="outline"
                      onClick={() => downloadErrorsCsv('hts-import-errors.csv', ['row','hts_code','category','description','unit_of_measure','duty_rate','hts_code_error','category_error','description_error','unit_of_measure_error','duty_rate_error'], importErrors)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Errors CSV
                    </Button>
                    <Button
                      variant="outline"
                      className="ml-2"
                      onClick={() => setShowErrorTable(prev => !prev)}
                    >
                      {showErrorTable ? 'Hide Errors Table' : 'Show Errors Table'}
                    </Button>
                  </ActionsToolbar>
                  {showErrorTable && (
                    <div className="mt-3 overflow-auto border rounded">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-muted">
                            <th className="px-2 py-1 text-left">Row</th>
                            <th className="px-2 py-1 text-left">HTS Code</th>
                            <th className="px-2 py-1 text-left">Category</th>
                            <th className="px-2 py-1 text-left">Description</th>
                            <th className="px-2 py-1 text-left">UOM1</th>
                            <th className="px-2 py-1 text-left">UOM2</th>
                            <th className="px-2 py-1 text-left">Duty Rate</th>
                            <th className="px-2 py-1 text-left">HTS Error</th>
                            <th className="px-2 py-1 text-left">Category Error</th>
                            <th className="px-2 py-1 text-left">Description Error</th>
                            <th className="px-2 py-1 text-left">UOM1 Error</th>
                            <th className="px-2 py-1 text-left">UOM2 Error</th>
                            <th className="px-2 py-1 text-left">Duty Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importErrors.map((err, i) => (
                            <tr key={`err-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-2 py-1">{err.row}</td>
                              <td className="px-2 py-1">{err.hts_code}</td>
                              <td className="px-2 py-1">{err.category}</td>
                              <td className="px-2 py-1">{err.description}</td>
                              <td className="px-2 py-1">{err.uom1}</td>
                              <td className="px-2 py-1">{err.uom2}</td>
                              <td className="px-2 py-1">{err.duty_rate}</td>
                              <td className="px-2 py-1 text-red-600">{err.hts_code_error}</td>
                              <td className="px-2 py-1 text-red-600">{err.category_error}</td>
                              <td className="px-2 py-1 text-red-600">{err.description_error}</td>
                              <td className="px-2 py-1 text-red-600">{err.uom1_error}</td>
                              <td className="px-2 py-1 text-red-600">{err.uom2_error}</td>
                              <td className="px-2 py-1 text-red-600">{err.duty_rate_error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Export Data</h2>
              <p className="text-gray-600 mb-6">
                Download all codes or filtered results as CSV/XLSX for backup or external use.
              </p>

              <ActionsToolbar label="Export" labelVariant="outline">
                <Button
                  onClick={handleExport}
                  className="bg-green-600 text-white hover:bg-green-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => exportExcel(`aes-hts-codes-${new Date().toISOString().split('T')[0]}.xlsx`, expectedHeaders, filteredCodes)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export XLSX
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportJson(`aes-hts-codes-${new Date().toISOString().split('T')[0]}.json`, filteredCodes)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export JSON
                </Button>
              </ActionsToolbar>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Seed Sample Data</h2>
              <p className="text-gray-600 mb-6">
                Populate your database with authentic sample HTS/Schedule B codes for testing and demonstration.
              </p>
              
              <button
                onClick={seedDatabase}
                disabled={!isConnected || loading}
                className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Database className="w-5 h-5" />
                {loading ? 'Seeding...' : 'Seed Sample Data'}
              </button>
              
              {!isConnected && (
                <p className="text-sm text-amber-600 mt-3">
                  ⚠️ Please connect to Supabase first to seed data
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AESHTSCodeManager;