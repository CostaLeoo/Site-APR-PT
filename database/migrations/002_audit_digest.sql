-- Digest covers the stored event, rather than unstored source data.
CREATE FUNCTION app.audit_digest(event_id uuid,tenant uuid,actor text,action text,resource text,resource_id text,payload jsonb,occurred timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(jsonb_build_object(
    'id',event_id,'tenantId',tenant,'actor',actor,'action',action,'resource',resource,
    'resourceId',resource_id,'payload',payload,'createdAt',to_char(occurred AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  )::text,'UTF8')),'hex')
$$;
REVOKE ALL ON FUNCTION app.audit_digest(uuid,uuid,text,text,text,text,jsonb,timestamptz) FROM PUBLIC;
CREATE OR REPLACE FUNCTION app.audit_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE data jsonb; event_id uuid := gen_random_uuid(); occurred timestamptz := clock_timestamp(); tenant uuid; actor text; payload jsonb; resource_id text;
BEGIN
  data := to_jsonb(NEW);
  tenant := CASE WHEN TG_TABLE_NAME='tenants' THEN NEW.id ELSE (data->>'tenantId')::uuid END;
  actor := coalesce(app.subject(),'migration');
  resource_id := coalesce(data->>'id',data->>'membershipId');
  payload := jsonb_build_object('version',data->'version','fields',ARRAY(SELECT jsonb_object_keys(data)));
  INSERT INTO public.audit_events(id,"tenantId",actor,action,resource,"resourceId",payload,hash,"createdAt")
  VALUES(event_id,tenant,actor,TG_OP,TG_TABLE_NAME,resource_id,payload,
    app.audit_digest(event_id,tenant,actor,TG_OP,TG_TABLE_NAME,resource_id,payload,occurred),occurred);
  RETURN NEW;
END $$;
-- Explicit migration of pre-existing foundation events to the defined digest representation.
UPDATE audit_events SET hash=app.audit_digest(id,"tenantId",actor,action,resource,"resourceId",payload,"createdAt");
