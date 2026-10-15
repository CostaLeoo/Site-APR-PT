-- Migration owner must NOT be the runtime role. Context is transaction-local.
CREATE SCHEMA IF NOT EXISTS app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "legalName" text NOT NULL,
  name text NOT NULL, cnpj text NOT NULL UNIQUE, version integer NOT NULL DEFAULT 1,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenantId" uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL, version integer NOT NULL DEFAULT 1, "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("tenantId",id), UNIQUE ("tenantId",name)
);
CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenantId" uuid NOT NULL REFERENCES tenants(id),
  "userId" text NOT NULL, "displayName" text NOT NULL,
  role text NOT NULL CHECK (role IN ('COMPANY_ADMIN','SST','SUPERVISOR','EXECUTOR','AUDITOR')),
  active boolean NOT NULL DEFAULT true, "allUnits" boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1, "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("tenantId","userId"), UNIQUE ("tenantId",id),
  CHECK (role <> 'COMPANY_ADMIN' OR "allUnits")
);
CREATE TABLE unit_scopes (
  "tenantId" uuid NOT NULL, "membershipId" uuid NOT NULL, "unitId" uuid NOT NULL,
  PRIMARY KEY ("tenantId","membershipId","unitId"),
  FOREIGN KEY ("tenantId","membershipId") REFERENCES memberships("tenantId",id),
  FOREIGN KEY ("tenantId","unitId") REFERENCES units("tenantId",id)
);
CREATE TABLE sessions (
  hash text PRIMARY KEY, "userId" text NOT NULL, "displayName" text NOT NULL,
  csrf text NOT NULL, mfa boolean NOT NULL,
  "expiresAt" timestamptz NOT NULL, "idleExpiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON sessions("expiresAt");
CREATE TABLE login_attempts (
  hash text PRIMARY KEY, state text NOT NULL, nonce text NOT NULL, verifier text NOT NULL,
  "expiresAt" timestamptz NOT NULL
);
CREATE TABLE platform_operators ("userId" text PRIMARY KEY);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenantId" uuid NOT NULL,
  actor text NOT NULL, action text NOT NULL, resource text NOT NULL, "resourceId" text NOT NULL,
  payload jsonb NOT NULL, hash text NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_events("tenantId","createdAt");
CREATE TABLE request_limits (key text PRIMARY KEY, hits integer NOT NULL, "resetAt" timestamptz NOT NULL);

CREATE FUNCTION app.subject() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.subject',true),'') $$;
CREATE FUNCTION app.tenant() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.tenant',true),'')::uuid $$;
-- Owner bypass is intentional only in narrowly scoped membership lookup, never in runtime queries.
CREATE FUNCTION app.is_member(t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS
$$ SELECT EXISTS(SELECT 1 FROM public.memberships WHERE "tenantId"=t AND "userId"=app.subject() AND active) $$;
CREATE FUNCTION app.is_operator() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS
$$ SELECT EXISTS(SELECT 1 FROM public.platform_operators WHERE "userId"=app.subject()) $$;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON tenants FOR SELECT USING (app.is_member(id));
CREATE POLICY tenant_update ON tenants FOR UPDATE USING (id=app.tenant() AND app.is_member(id)) WITH CHECK (id=app.tenant() AND app.is_member(id));
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_read ON memberships FOR SELECT USING ("userId"=app.subject() OR ("tenantId"=app.tenant() AND app.is_member("tenantId")));
CREATE POLICY membership_insert ON memberships FOR INSERT WITH CHECK ("tenantId"=app.tenant() AND app.is_member("tenantId"));
CREATE POLICY membership_update ON memberships FOR UPDATE USING ("tenantId"=app.tenant() AND app.is_member("tenantId")) WITH CHECK ("tenantId"=app.tenant() AND app.is_member("tenantId"));
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE units FORCE ROW LEVEL SECURITY;
CREATE POLICY units_tenant ON units USING ("tenantId"=app.tenant() AND app.is_member("tenantId")) WITH CHECK ("tenantId"=app.tenant() AND app.is_member("tenantId"));
ALTER TABLE unit_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_scopes FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_tenant ON unit_scopes USING ("tenantId"=app.tenant() AND app.is_member("tenantId")) WITH CHECK ("tenantId"=app.tenant() AND app.is_member("tenantId"));
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_tenant ON audit_events FOR SELECT USING ("tenantId"=app.tenant() AND app.is_member("tenantId"));

CREATE FUNCTION app.audit_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE data jsonb; event_id uuid := gen_random_uuid(); occurred timestamptz := clock_timestamp(); tenant uuid;
BEGIN
  data := to_jsonb(NEW);
  tenant := CASE WHEN TG_TABLE_NAME='tenants' THEN NEW.id ELSE (data->>'tenantId')::uuid END;
  INSERT INTO public.audit_events(id,"tenantId",actor,action,resource,"resourceId",payload,hash,"createdAt")
  VALUES(event_id,tenant,coalesce(app.subject(),'migration'),TG_OP,TG_TABLE_NAME,coalesce(data->>'id',data->>'membershipId'),
    jsonb_build_object('version',data->'version','fields',ARRAY(SELECT jsonb_object_keys(data))),
    encode(sha256(convert_to(event_id::text || data::text || occurred::text,'UTF8')),'hex'),occurred);
  RETURN NEW;
END $$;
CREATE TRIGGER audit_tenants AFTER INSERT OR UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION app.audit_change();
CREATE TRIGGER audit_units AFTER INSERT OR UPDATE ON units FOR EACH ROW EXECUTE FUNCTION app.audit_change();
CREATE TRIGGER audit_memberships AFTER INSERT OR UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION app.audit_change();

-- Commercial API has no query path to customer content.
CREATE FUNCTION app.commercial_tenants() RETURNS TABLE(id uuid,name text,"legalName" text,cnpj text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS
$$ SELECT id,name,"legalName",cnpj FROM public.tenants WHERE app.is_operator() $$;
CREATE FUNCTION app.provision_tenant(legal text,trade text,tax text,admin_subject text,admin_name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t uuid;
BEGIN
  IF NOT app.is_operator() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  INSERT INTO public.tenants("legalName",name,cnpj) VALUES(legal,trade,tax) RETURNING id INTO t;
  INSERT INTO public.memberships("tenantId","userId","displayName",role,"allUnits") VALUES(t,admin_subject,admin_name,'COMPANY_ADMIN',true);
  RETURN t;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA public,app TO apr_app;
GRANT SELECT,UPDATE ON tenants TO apr_app;
GRANT SELECT,INSERT,UPDATE ON units,memberships TO apr_app;
GRANT SELECT,INSERT,DELETE ON unit_scopes TO apr_app;
GRANT SELECT ON audit_events TO apr_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON sessions,login_attempts,request_limits TO apr_app;
GRANT EXECUTE ON FUNCTION app.subject(),app.tenant(),app.is_member(uuid),app.is_operator(),app.commercial_tenants(),app.provision_tenant(text,text,text,text,text) TO apr_app;
