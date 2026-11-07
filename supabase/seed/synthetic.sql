-- Synthetic-only benchmark seed. Never place production data here.
insert into public.profiles(user_id,email,role,status) values
  ('synthetic-a','synthetic-a@example.test','user','active'),
  ('synthetic-b','synthetic-b@example.test','user','active'),
  ('synthetic-pending','synthetic-pending@example.test','user','pending');
