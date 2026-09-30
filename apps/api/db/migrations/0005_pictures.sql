-- Covers and pictures in Notes live in one private Storage bucket, one folder per writer
-- (<user id>/<picture id>). No storage policies, on purpose: browsers cannot reach the bucket
-- at all. Only the API does, with the service key, and it builds every path from the signed-in
-- writer's id, so a writer can only ever read or write their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pictures', 'pictures', false, 5242880, array['image/jpeg', 'image/webp']);
