-- Injected only into the generated, disposable Supabase test project's first migration.
-- Lets that project's migration role SET ROLE when changing V2 function owners.
grant vx_sub_v2_executor to current_user;
