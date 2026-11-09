alter table public.comments drop constraint if exists comments_check1;

alter table public.comments drop constraint if exists comments_content_not_blank;
alter table public.comments add constraint comments_content_not_blank
  check (body is not null or image_url is not null);
