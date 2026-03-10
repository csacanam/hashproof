-- Default template: used when no template is passed to issue_credential.
-- Minimal: just holder name. Run after schema.sql.
-- Assumes empty DB (after drop schema + schema.sql).

-- HashProof platform entity
insert into entities (display_name, slug, email_verified, last_verified_at, status)
values ('HashProof', 'hashproof', true, now(), 'organization_verified')
on conflict (slug) do update set
  email_verified = excluded.email_verified,
  last_verified_at = excluded.last_verified_at,
  status = excluded.status;

-- Default template (belongs to HashProof entity)
-- Page: 3508 x 2480 px
insert into templates (entity_id, name, slug, background_url, page_width, page_height, fields_json)
select e.id, 'HashProof', 'hashproof', 'https://tdsboovupretgiuuqeqy.supabase.co/storage/v1/object/public/teamplates/certificate.png', 3508, 2480,
  '[
    {"key": "holder_name", "x": 248, "y": 1200, "width": 3012, "height": 312, "required": true, "font_size": 192, "font_color": "#9a7e2c", "align": "center"},
    {"key": "details", "x": 716, "y": 1488, "width": 2077, "height": 169, "required": false, "font_size": 84, "font_color": "#000000", "align": "center"}
  ]'::jsonb
from entities e where e.slug = 'hashproof'
on conflict (entity_id, slug) do update set
  name = excluded.name,
  background_url = excluded.background_url,
  page_width = excluded.page_width,
  page_height = excluded.page_height,
  fields_json = excluded.fields_json;
