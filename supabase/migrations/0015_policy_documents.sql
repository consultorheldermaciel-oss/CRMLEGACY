-- Lets a consultor attach the actual policy document (PDF/scan) when
-- registering it in the Carteira de Clientes — no more hunting across
-- multiple portals to find it again later.
alter table public.policies add column document_path text;

-- Private bucket (unlike avatars): these are real policy documents with the
-- client's personal and financial data, so reads are RLS-gated through
-- manages() and the app fetches them via short-lived signed URLs, never a
-- public link. Object path convention: <consultant_id>/<policy_id>/<filename>.
insert into storage.buckets (id, name, public)
values ('policy-documents', 'policy-documents', false)
on conflict (id) do nothing;

create policy "policy_documents_select" on storage.objects for select
  using (bucket_id = 'policy-documents' and public.manages((storage.foldername(name))[1]::uuid));
create policy "policy_documents_insert" on storage.objects for insert
  with check (bucket_id = 'policy-documents' and public.manages((storage.foldername(name))[1]::uuid));
create policy "policy_documents_update" on storage.objects for update
  using (bucket_id = 'policy-documents' and public.manages((storage.foldername(name))[1]::uuid));
create policy "policy_documents_delete" on storage.objects for delete
  using (bucket_id = 'policy-documents' and public.manages((storage.foldername(name))[1]::uuid));
