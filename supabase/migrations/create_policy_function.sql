-- Create a function to get policy information
CREATE OR REPLACE FUNCTION get_policies_info()
RETURNS TABLE (
    tablename text,
    policyname text,
    cmd text,
    roles text[],
    using_expr text,
    with_check_expr text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.tablename::text,
        p.policyname::text,
        p.cmd::text,
        p.roles,
        p.qual::text AS using_expr,
        p.with_check::text AS with_check_expr
    FROM 
        pg_policies p
    WHERE 
        p.schemaname = 'public'
    ORDER BY 
        p.tablename, 
        p.policyname;
END;
$$ LANGUAGE plpgsql; 