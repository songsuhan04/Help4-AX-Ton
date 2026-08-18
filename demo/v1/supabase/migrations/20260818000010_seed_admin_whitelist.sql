insert into admin_whitelist (email) values ('admin@ad.min')
on conflict (email) do nothing;
