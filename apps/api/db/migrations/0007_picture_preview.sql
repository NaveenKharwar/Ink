-- A tiny blurred preview of each picture (a few hundred bytes, as a data: URL), made on the
-- device at upload, so grids can show something at once while the small copy loads.
alter table public.pictures
  add column preview text check (preview is null or length(preview) <= 4000);
