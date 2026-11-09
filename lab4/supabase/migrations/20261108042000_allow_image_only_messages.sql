alter table public.messages drop constraint if exists messages_check1;

alter table public.messages drop constraint if exists messages_content_not_blank;
alter table public.messages add constraint messages_content_not_blank
  check (body is not null or image_url is not null or shared_post_id is not null);
