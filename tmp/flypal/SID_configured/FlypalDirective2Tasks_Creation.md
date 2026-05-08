importing .csv file into fly.directives table
follow : ABCD formula once scren shots copied into .csv file ( refer /tmp/flypal/ATAforModel.ods)
1. Prepare "Configured Directives PC - 12-45.csv"  first few columns ( A to H)
2. from I conlumn onword get data from  copying data from the screen shots of flypal
3. Remove the spaces and last columns from the .csv file
4. uplaod the data into flypal.flypal_configured_directives
4. run the edge functions : 
    a. flypal_configured_directives_parse_frequency
    b. flypal_configured_directives_id_match
5. Make sure all the data are parsed well and directives_id are populated well in the column of table flypal.flypal_configured_directives
6. run the next edge function : flypal_configured_directives_create_task
