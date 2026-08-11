
REVOKE EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.are_mutual_follows(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_send_message(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_mutual_follows(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_message(uuid, uuid) TO authenticated;
