-- handle_new_user() is a SECURITY DEFINER trigger function; it must not be
-- callable through the REST API (/rest/v1/rpc/handle_new_user).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
