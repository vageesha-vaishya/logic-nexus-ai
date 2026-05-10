importing .csv file into fly.directives table
follow : ABCD formula once scren shots copied into .csv file ( refer /tmp/flypal/ATAforModel.ods)
1. Prepare "Configured Directives PC - 12-45.csv"  first few columns ( A to H)
2. from I conlumn onword get data from  copying data from the screen shots of flypal
3. Remove the spaces and last columns from the .csv file
4. uplaod the data into flypal.flypal_configured_directives



4. run the edge functions flypal_configured_directives_parse_frequency 

before running the edge function :
update flypal.flypal_configured_directives set is_frequency_parsed_success =false

after running the edge function to validate the data :
select fcd.effective_from , fcd.effective_from_2_actual_end_date, fcd.effective_from_2_actual_end_hours from flypal.flypal_configured_directives fcd where fcd.effective_from is not null

after running the edge function to validate the data :
select fcd.current , fcd.current_2_aircraft_current_flight_hours, fcd.current_2_aircraft_current_landings, fcd.current_2_aircraft_current_reading_date from flypal.flypal_configured_directives fcd where fcd.current is not null

after running the edge function to validate the data :
select fcd.is_frequency_parsed_success, fcd.failure_reason from  flypal.flypal_configured_directives fcd  where fcd.is_frequency_parsed_success =false

 Input fields (raw text):                                                                     
  - frequency / frequecny — e.g. "3000H, 500C, 12Mt" — maintenance intervals
  - effective_from — e.g. "5000H" or "15-Jan-2024" — when the directive took effect            
  - current — e.g. "4500.5H, 150L, 10-Mar-2024" — aircraft's current state                   
                                                                                               
  Output fields (parsed/structured):                                                           
                                                                                               
  ┌──────────────────┬─────────────────────────────────────────────────────────────────────┐   
  │    Raw Field     │                             Parsed Into                             │   
  ├──────────────────┼─────────────────────────────────────────────────────────────────────┤ 
  │ frequency (H)    │ threshold_hours (interval HH:MM:SS)                                 │ 
  ├──────────────────┼─────────────────────────────────────────────────────────────────────┤
  │ frequency (C)    │ threshold_cycles (int)                                              │   
  ├──────────────────┼─────────────────────────────────────────────────────────────────────┤   
  │ frequency (L)    │ threshold_landings (int)                                            │   
  ├──────────────────┼─────────────────────────────────────────────────────────────────────┤   
  │ frequency        │ threshold_calendar + calendar_unit                                  │ 
  │ (Dy/Mt/Yr)       │                                                                     │   
  ├──────────────────┼─────────────────────────────────────────────────────────────────────┤
  │ frequency (RI)   │ threshold_rins (int)                                                │   
  ├──────────────────┼─────────────────────────────────────────────────────────────────────┤ 
  │ frequency (Ho)   │ threshold_hobbs (int)                                               │   
  ├──────────────────┼─────────────────────────────────────────────────────────────────────┤
  │ effective_from   │ effective_from_2_actual_end_hours +                                 │   
  │                  │ effective_from_2_actual_end_date                                    │ 
  ├──────────────────┼─────────────────────────────────────────────────────────────────────┤ 
  │                  │ current_2_aircraft_current_flight_hours +                           │
  │ current          │ current_2_aircraft_current_landings +                               │   
  │                  │ current_2_aircraft_current_reading_date                             │
  └──────────────────┴─────────────────────────────────────────────────────────────────────┘   
                                                                                             
  Processing logic                                                                           

  1. Fetches rows in batches (default 500, max 5000) to avoid memory issues                    
  2. Skips already-parsed rows (is_frequency_parsed_success = true) unless effective_from or
  current data is missing                                                                      
  3. Parses each row, writes structured values back to the DB                                
  4. Marks success/failure via is_frequency_parsed_success boolean                             
  5. Returns a summary: total_rows, parsed_rows, skipped_rows, failed_rows, failures[]         
                                                                                               
  Key helpers                                                                                  
                                                                                               
  ┌───────────────────────┬─────────────────────────────────────────────────────────────────┐
  │       Function        │                             Purpose                             │
  ├───────────────────────┼─────────────────────────────────────────────────────────────────┤
  │ parseFrequency()      │ Regex-scans frequency text for unit tokens (H, C, L, Dy, Mt,    │
  │                       │ Yr, RI, Ho)                                                     │
  ├───────────────────────┼─────────────────────────────────────────────────────────────────┤  
  │ parseEffectiveFrom()  │ Parses hours (5000H) or date (15-Jan-2024) from effective_from  │
  ├───────────────────────┼─────────────────────────────────────────────────────────────────┤  
  │ parseCurrent()        │ Parses hours, landings (150L), or date from current             │
  ├───────────────────────┼─────────────────────────────────────────────────────────────────┤  
  │ toIntervalText()      │ Converts decimal/colon hours to HH:MM:SS interval format        │
  ├───────────────────────┼─────────────────────────────────────────────────────────────────┤  
  │ parseDdMmmYyyyToIso() │ Converts 15-Jan-2024 → 2024-01-15                               │
  ├───────────────────────┼─────────────────────────────────────────────────────────────────┤  
  │ setParsedStatus()     │ Updates is_frequency_parsed_success on failure                  │
  └───────────────────────┴─────────────────────────────────────────────────────────────────┘  














4. run the edge functions flypal_configured_directives_id_match 
this edge fucntion call the database fucntion flypal_configured_directives_id_match
after success  : is_id_match_success = true
















5. Make sure all the data are parsed well and directives_id are populated well in the column of table flypal.flypal_configured_directives
6. run the next edge function : flypal_configured_directives_create_task : is_task_created_success - true
Column Mapping: flypal_configured_directives → public.tasks

  flypal_configured_directives: tenant_id
  public.tasks: tenant_id
  Type: uuid
  Notes: Direct
  ────────────────────────────────────────
  flypal_configured_directives: franchise_id
  public.tasks: franchise_id
  Type: uuid
  Notes: Direct
  ────────────────────────────────────────
  flypal_configured_directives: directive_id
  public.tasks: directive_id
  Type: uuid
  Notes: Direct FK
  ────────────────────────────────────────
  flypal_configured_directives: frequency_sequence
  public.tasks: sequence_order
  Type: integer
  Notes: Task ordering
  ────────────────────────────────────────
  flypal_configured_directives: directive_no + frequency_sequence
  public.tasks: task_number
  Type: text
  Notes: Generated: TASK-{DN}-{seq}
  ────────────────────────────────────────
  flypal_configured_directives: code_form_no_and_description
  public.tasks: title
  Type: text
  Notes: Fallback: directive_no
  ────────────────────────────────────────
  flypal_configured_directives: notes
  public.tasks: description
  Type: text
  Notes: Direct
  ────────────────────────────────────────
  flypal_configured_directives: category_code
  public.tasks: task_category
  Type: text
  Notes: Fallback: 'maintenance'
  ────────────────────────────────────────
  flypal_configured_directives: reference_amp
  public.tasks: procedure_reference
  Type: varchar
  Notes: AMP reference
  ────────────────────────────────────────
  flypal_configured_directives: last_done_on
  public.tasks: actual_end_date
  Type: timestamptz
  Notes: Cast from date
  ────────────────────────────────────────
  flypal_configured_directives: effective_from_2_actual_end_date
  public.tasks: planned_start_date
  Type: timestamptz
  Notes: Effective-from date
  ────────────────────────────────────────
  flypal_configured_directives: effective_from_2_actual_end_hours
  public.tasks: actual_end_hours
  Type: interval
  Notes: Direct
  ────────────────────────────────────────
  flypal_configured_directives: threshold_hours
  public.tasks: estimated_duration_hours
  Type: decimal
  Notes: Hours extracted from interval
  ────────────────────────────────────────
  flypal_configured_directives: threshold_cycles, threshold_calendar, threshold_landings,
    threshold_rins, threshold_hobbs, current_*
  public.tasks: checklist (jsonb)
  Type: jsonb
  Notes: Preserved — no direct columns
  ────────────────────────────────────────
  flypal_configured_directives: registration, serial_number, ata_code, assembly_models,        
    aircraft_template_id
  public.tasks: checklist (jsonb)                                                              
  Type: jsonb                                                                                
  Notes: Preserved for reference

  ---
  Identified Gaps
                                                                                               
  #: 1                                           
  Gap: No work_order_id in source                                                              
  Impact: work_order_id is nullable (per migration) but tasks are "orphaned" — not linked to 
  any                                            
    work order
  Recommended Resolution: Before running this function, create one "FlyPal Import" work order  
    per aircraft and pass its ID via query param, or add a pre-step to create work orders per
    aircraft_template_id                                                                       
  ────────────────────────────────────────                                                   
  #: 2                                                                                         
  Gap: is_row_processed_success conflict
  Impact: The id_match step already sets this flag to true. Using the same flag for task       
    creation would cause confusion                                                           
  Recommended Resolution: Fixed: Added dedicated is_task_created_success column (migration
    20260509100000) and the function uses that instead
  ────────────────────────────────────────
  #: 3                                                                                         
  Gap: No aircraft_id on tasks
  Impact: Aircraft identity is only traceable via work_order_id → work_orders.aircraft_id. With
                                                                                             
    work_order_id = null, aircraft context is lost in tasks
  Recommended Resolution: Stored registration, serial_number, assembly_models,
    aircraft_template_id in checklist jsonb as a bridge until linked to a work order
  ────────────────────────────────────────
  #: 4                                                                                         
  Gap: threshold_cycles/calendar/landings/rins/hobbs have no tasks columns
  Impact: Interval data (cycles, calendar, landings) is not captured in tasks schema           
  Recommended Resolution: Stored in checklist jsonb. Ideally add dedicated columns to        
    public.tasks for AMRO compliance tracking
  ────────────────────────────────────────
  #: 5                                                                                         
  Gap: current_* columns (flight hours, landings, reading date)
  Impact: Aircraft's current state at time of import — not a task field                        
  Recommended Resolution: Stored in checklist jsonb                                          
  ────────────────────────────────────────
  #: 6                                                                                         
  Gap: Duplicate task guard
  Impact: If the function is run twice, the created_task_id IS NULL filter prevents duplicates 
  —                                                                                          
    but only if the first update succeeded. If the task was inserted but the update failed,
    re-running will create a second task
  Recommended Resolution: Acceptable risk given the warning log. For zero-tolerance: add a
    UNIQUE constraint on (directive_id, tenant_id) in tasks or check by directive_id before
    inserting
  ────────────────────────────────────────
  #: 7                                                                                         
  Gap: task_number uniqueness
  Impact: task_number is NOT NULL but has no UNIQUE constraint in schema. Running the function 
    twice may produce duplicate task numbers                                                 
  Recommended Resolution: Guard is the created_task_id IS NULL filter — same as gap 6

  Query Parameters

  ┌────────────┬─────────┬───────────────────────────────────────────┐                         
  │   Param    │ Default │                Description                │
  ├────────────┼─────────┼───────────────────────────────────────────┤                         
  │ batch_size │ 200     │ Rows per loop (max 2000)                  │                       
  ├────────────┼─────────┼───────────────────────────────────────────┤
  │ tenant_id  │ none    │ If set, only process rows for that tenant │
  └────────────┴─────────┴───────────────────────────────────────────┘                         
  select id from tasks where id in (
select fcd.created_task_id from flypal.flypal_configured_directives fcd)


  refresh the data into tasks & flypal_configured_directives tables
delete from tasks where id in (
select id from tasks where id in (
select fcd.created_task_id from flypal.flypal_configured_directives fcd))

update flypal.flypal_configured_directives set is_task_created_success = FALSE and created_task_id = NULL and task_created_failure_reason = NULL where is_task_created_success = TRUE

