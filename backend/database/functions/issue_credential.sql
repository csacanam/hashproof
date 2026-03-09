-- Function: issue_credential(payload jsonb, base_url text)
-- Full credential issuance in one call: issuer, platform, holder, context, template, values.
-- Template: pass template_id/template_slug to use existing, OR template object to create inline.
-- Returns: { id, verification_url, tx_hash, credential_hash }

create or replace function issue_credential(p_payload jsonb, p_base_url text default 'https://hashproof.example.com')
returns jsonb
language plpgsql
security definer
as $$
declare
  v_issuer jsonb;
  v_platform jsonb;
  v_holder jsonb;
  v_context jsonb;
  v_template jsonb;
  v_template_id uuid;
  v_template_slug text;
  v_credential_type text;
  v_title text;
  v_issued_at timestamptz;
  v_expires_at timestamptz;
  v_values jsonb;

  v_issuer_id uuid;
  v_platform_id uuid;
  v_holder_id uuid;
  v_context_id uuid;
  v_template_record record;
  v_credential_json jsonb;
  v_credential_hash text;
  v_tx_hash text;
  v_credential_id uuid;
  v_issued_ts timestamptz;
  v_expires_ts timestamptz;

  v_slug_lower text;
  v_field jsonb;
  v_val text;
begin
  v_issuer := p_payload->'issuer';
  v_platform := p_payload->'platform';
  v_holder := p_payload->'holder';
  v_context := p_payload->'context';
  v_template := p_payload->'template';
  v_template_id := (p_payload->>'template_id')::uuid;
  v_template_slug := p_payload->>'template_slug';
  v_credential_type := p_payload->>'credential_type';
  v_title := p_payload->>'title';
  v_issued_at := (p_payload->>'issued_at')::timestamptz;
  v_expires_at := (p_payload->>'expires_at')::timestamptz;
  v_values := coalesce(p_payload->'values', '{}'::jsonb);

  if v_issuer is null or v_issuer->>'display_name' is null or v_issuer->>'slug' is null then
    raise exception 'issuer.display_name and issuer.slug required';
  end if;
  if v_platform is null or v_platform->>'display_name' is null or v_platform->>'slug' is null then
    raise exception 'platform.display_name and platform.slug required';
  end if;
  if v_holder is null or v_holder->>'full_name' is null then
    raise exception 'holder.full_name required';
  end if;
  if v_context is null or v_context->>'type' is null or v_context->>'title' is null then
    raise exception 'context.type and context.title required';
  end if;
  if v_credential_type is null or v_title is null then
    raise exception 'credential_type and title required';
  end if;

  -- Template: template_id, template_slug, template object, or base template (when none passed)

  v_issued_ts := coalesce(v_issued_at, now());
  v_expires_ts := v_expires_at;

  -- Get or create issuer
  v_slug_lower := lower(regexp_replace(v_issuer->>'slug', '\s+', '-', 'g'));
  select id into v_issuer_id from entities where slug = v_slug_lower and role = 'issuer' limit 1;
  if v_issuer_id is null then
    insert into entities (role, display_name, slug, website, logo_url)
    values ('issuer', v_issuer->>'display_name', v_slug_lower, v_issuer->>'website', v_issuer->>'logo_url')
    returning id into v_issuer_id;
  end if;

  -- Get or create platform
  v_slug_lower := lower(regexp_replace(v_platform->>'slug', '\s+', '-', 'g'));
  select id into v_platform_id from entities where slug = v_slug_lower and role = 'platform' limit 1;
  if v_platform_id is null then
    insert into entities (role, display_name, slug, website, logo_url)
    values ('platform', v_platform->>'display_name', v_slug_lower, v_platform->>'website', v_platform->>'logo_url')
    returning id into v_platform_id;
  end if;

  -- Get or create holder
  select id into v_holder_id from holders
  where full_name = v_holder->>'full_name'
    and coalesce(email, '') = coalesce(v_holder->>'email', '')
    and coalesce(external_id, '') = coalesce(v_holder->>'external_id', '')
  limit 1;
  if v_holder_id is null then
    insert into holders (full_name, email, phone, external_id)
    values (
      v_holder->>'full_name',
      v_holder->>'email',
      v_holder->>'phone',
      v_holder->>'external_id'
    )
    returning id into v_holder_id;
  end if;

  -- Get or create context
  select id into v_context_id from contexts
  where type = (v_context->>'type')::context_type
    and title = v_context->>'title'
    and coalesce(external_id, '') = coalesce(v_context->>'external_id', '')
  limit 1;
  if v_context_id is null then
    insert into contexts (type, title, description, external_id, starts_at, ends_at)
    values (
      (v_context->>'type')::context_type,
      v_context->>'title',
      v_context->>'description',
      v_context->>'external_id',
      (v_context->>'starts_at')::timestamptz,
      (v_context->>'ends_at')::timestamptz
    )
    returning id into v_context_id;
  end if;

  -- Get or create template
  if v_template_id is not null then
    select id, fields_json into v_template_record from templates where id = v_template_id;
    if v_template_record.id is null then
      raise exception 'Template not found';
    end if;
  elsif v_template_slug is not null and v_template_slug != '' then
    v_slug_lower := lower(regexp_replace(v_template_slug, '\s+', '-', 'g'));
    select id, fields_json into v_template_record from templates where slug = v_slug_lower;
    if v_template_record.id is null then
      raise exception 'Template not found';
    end if;
  elsif v_template is not null
    and v_template->>'slug' is not null
    and v_template->>'name' is not null
    and v_template->>'background_url' is not null
    and (v_template->>'page_width')::int is not null
    and (v_template->>'page_height')::int is not null
    and v_template->'fields_json' is not null
  then
    v_slug_lower := lower(regexp_replace(v_template->>'slug', '\s+', '-', 'g'));
    select id, fields_json into v_template_record from templates where slug = v_slug_lower limit 1;
    if v_template_record.id is null then
      insert into templates (name, slug, background_url, page_width, page_height, fields_json)
      values (
        v_template->>'name',
        v_slug_lower,
        v_template->>'background_url',
        (v_template->>'page_width')::int,
        (v_template->>'page_height')::int,
        coalesce(v_template->'fields_json', '[]'::jsonb)
      )
      on conflict (slug) do update set
        name = excluded.name,
        background_url = excluded.background_url,
        page_width = excluded.page_width,
        page_height = excluded.page_height,
        fields_json = excluded.fields_json
      returning id, fields_json into v_template_record;
    end if;
  else
    -- Default template (from seed): used when no template passed
    v_slug_lower := 'hashproof';
    select id, fields_json into v_template_record from templates where slug = v_slug_lower limit 1;
    if v_template_record.id is null then
      raise exception 'Default template not found. Run database/seed.sql first.';
    end if;
  end if;

  -- Validate required template values
  for v_field in select * from jsonb_array_elements(v_template_record.fields_json)
  loop
    if v_field->>'key' is not null and coalesce((v_field->>'required')::boolean, false) then
      v_val := v_values->>(v_field->>'key');
      if v_val is null or trim(v_val) = '' then
        raise exception 'Missing required template value for key: %', v_field->>'key';
      end if;
    end if;
  end loop;

  -- Build credential_json (before proof)
  -- Self-contained per VC: issuer, platform, title, context for verification without DB lookups
  v_credential_json := jsonb_build_object(
    '@context', jsonb_build_array('https://www.w3.org/ns/credentials/v2'),
    'type', jsonb_build_array('VerifiableCredential'),
    'issuer', jsonb_build_object(
      'id', p_base_url || '/entities/' || v_issuer_id,
      'display_name', v_issuer->>'display_name'
    ),
    'platform', jsonb_build_object(
      'id', p_base_url || '/entities/' || v_platform_id,
      'display_name', v_platform->>'display_name'
    ),
    'name', v_title,
    'context', jsonb_build_object(
      'title', v_context->>'title'
    ),
    'credentialSubject', (
      v_values
      || jsonb_build_object('full_name', v_holder->>'full_name')
    ),
    'issuanceDate', to_char(v_issued_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
  if v_expires_ts is not null then
    v_credential_json := v_credential_json || jsonb_build_object(
      'expirationDate', to_char(v_expires_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  end if;
  v_credential_json := v_credential_json || '{"proof":{}}'::jsonb;

  -- Hash (canonical JSON text)
  v_credential_hash := encode(digest(v_credential_json::text, 'sha256'), 'hex');

  -- TODO: Real blockchain tx — register credential_hash on-chain, get tx_hash
  -- For now: mock tx_hash
  v_tx_hash := '0x' || encode(gen_random_bytes(32), 'hex');

  -- Add proof
  v_credential_json := jsonb_set(
    v_credential_json,
    '{proof}',
    jsonb_build_object(
      'type', 'HashProofBlockchain',
      'txHash', v_tx_hash,
      'contractAddress', '0x0000000000000000000000000000000000000000',
      'credentialHash', v_credential_hash
    )
  );

  -- Insert credential
  insert into credentials (
    issuer_entity_id, platform_entity_id, holder_id, context_id, template_id,
    credential_type, title, issued_at, expires_at,
    credential_json, credential_hash,
    chain_name, chain_id, contract_address, tx_hash, onchain_registered_at
  ) values (
    v_issuer_id, v_platform_id, v_holder_id, v_context_id, v_template_record.id,
    v_credential_type::credential_type, v_title, v_issued_ts, v_expires_ts,
    v_credential_json, v_credential_hash,
    'celo', 42220, '0x0000000000000000000000000000000000000000',
    v_tx_hash, now()
  )
  returning id into v_credential_id;

  return jsonb_build_object(
    'id', v_credential_id,
    'verification_url', p_base_url || '/verify/' || v_credential_id,
    'tx_hash', v_tx_hash,
    'credential_hash', v_credential_hash
  );
end;
$$;
