-- Initial PostgreSQL schema. Run once on a new database; does not change the Sites/D1 database.
BEGIN;

CREATE SCHEMA IF NOT EXISTS ritual;

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- Keep ritual out of the session search_path so DDL hooks also see qualified names.
-- All application DDL below names the private schema explicitly.
SET LOCAL search_path=pg_catalog,public,extensions;

CREATE TABLE ritual."app_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);

CREATE TABLE ritual."profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"is_platform_admin" bigint DEFAULT 0 NOT NULL
);

CREATE TABLE ritual."tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tagline" text DEFAULT 'Un buen corte. Sin la espera.' NOT NULL,
	"accent" text DEFAULT '#c2ed86' NOT NULL,
	"hero_url" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT 'America/Panama' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"plan" text DEFAULT 'Esencial' NOT NULL,
	"transfer_minutes" bigint DEFAULT 30 NOT NULL,
	"cancel_minutes" bigint DEFAULT 120 NOT NULL,
	"notice_minutes" bigint DEFAULT 30 NOT NULL,
	"advance_days" bigint DEFAULT 60 NOT NULL
);

CREATE UNIQUE INDEX "tenants_slug_unique" ON ritual."tenants" ("slug");

CREATE TABLE ritual."branches" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT 'America/Panama' NOT NULL,
	"opens" bigint DEFAULT 540 NOT NULL,
	"closes" bigint DEFAULT 1140 NOT NULL,
	"closed_days" text DEFAULT '[0]' NOT NULL,
	"active" bigint DEFAULT 1 NOT NULL,
	FOREIGN KEY ("tenant_id") REFERENCES ritual."tenants"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "branch_hours" CHECK("branches"."opens" >= 0 AND "branches"."closes" <= 1440 AND "branches"."opens" < "branches"."closes")
);

CREATE UNIQUE INDEX "branch_tenant_id" ON ritual."branches" ("tenant_id","id");

CREATE TABLE ritual."barbers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"initials" text NOT NULL,
	"active" bigint DEFAULT 1 NOT NULL,
	FOREIGN KEY ("tenant_id") REFERENCES ritual."tenants"("id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX "barber_tenant_id" ON ritual."barbers" ("tenant_id","id");

CREATE TABLE ritual."services" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"minutes" bigint NOT NULL,
	"price_cents" bigint NOT NULL,
	"buffer_minutes" bigint DEFAULT 5 NOT NULL,
	"active" bigint DEFAULT 1 NOT NULL,
	FOREIGN KEY ("tenant_id") REFERENCES ritual."tenants"("id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "service_values" CHECK("services"."minutes" >= 5 AND "services"."minutes" <= 480 AND "services"."price_cents" >= 0 AND "services"."buffer_minutes" >= 0)
);

CREATE UNIQUE INDEX "service_tenant_id" ON ritual."services" ("tenant_id","id");

CREATE TABLE ritual."memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"branch_ids" text DEFAULT '[]' NOT NULL,
	"barber_id" text,
	FOREIGN KEY ("tenant_id") REFERENCES ritual."tenants"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("user_id") REFERENCES ritual."profiles"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("tenant_id","barber_id") REFERENCES ritual."barbers"("tenant_id","id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX "membership_user_tenant" ON ritual."memberships" ("tenant_id","user_id");

CREATE TABLE ritual."access_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"branch_ids" text DEFAULT '[]' NOT NULL,
	"barber_id" text,
	FOREIGN KEY ("tenant_id") REFERENCES ritual."tenants"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("tenant_id","barber_id") REFERENCES ritual."barbers"("tenant_id","id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX "grant_tenant_email" ON ritual."access_grants" ("tenant_id","email");

CREATE TABLE ritual."branch_services" (
	"tenant_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"service_id" text NOT NULL,
	"minutes" bigint,
	"price_cents" bigint,
	PRIMARY KEY("tenant_id", "branch_id", "service_id"),
	FOREIGN KEY ("tenant_id","branch_id") REFERENCES ritual."branches"("tenant_id","id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("tenant_id","service_id") REFERENCES ritual."services"("tenant_id","id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE ritual."barber_services" (
	"tenant_id" text NOT NULL,
	"barber_id" text NOT NULL,
	"service_id" text NOT NULL,
	"minutes" bigint,
	"price_cents" bigint,
	PRIMARY KEY("tenant_id", "barber_id", "service_id"),
	FOREIGN KEY ("tenant_id","barber_id") REFERENCES ritual."barbers"("tenant_id","id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("tenant_id","service_id") REFERENCES ritual."services"("tenant_id","id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE ritual."shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"barber_id" text NOT NULL,
	"date" text NOT NULL,
	"start_at" bigint NOT NULL,
	"end_at" bigint NOT NULL,
	"break_start" bigint,
	"break_end" bigint,
	FOREIGN KEY ("tenant_id","branch_id") REFERENCES ritual."branches"("tenant_id","id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("tenant_id","barber_id") REFERENCES ritual."barbers"("tenant_id","id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shift_window_valid" CHECK("shifts"."start_at" < "shifts"."end_at"),
	CONSTRAINT "shift_break_valid" CHECK(("shifts"."break_start" IS NULL AND "shifts"."break_end" IS NULL) OR ("shifts"."break_start" IS NOT NULL AND "shifts"."break_end" IS NOT NULL AND "shifts"."break_start" >= "shifts"."start_at" AND "shifts"."break_end" <= "shifts"."end_at" AND "shifts"."break_start" < "shifts"."break_end"))
);

CREATE INDEX "shift_window" ON ritual."shifts" ("tenant_id","start_at","end_at");

CREATE TABLE ritual."bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"barber_id" text NOT NULL,
	"service_id" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"start_at" bigint NOT NULL,
	"end_at" bigint NOT NULL,
	"busy_until" bigint NOT NULL,
	"client_name" text NOT NULL,
	"client_phone" text NOT NULL,
	"client_email" text DEFAULT '' NOT NULL,
	"price_cents" bigint NOT NULL,
	"minutes" bigint NOT NULL,
	"service_name" text NOT NULL,
	"whatsapp_consent" bigint DEFAULT 0 NOT NULL,
	"reference" text NOT NULL,
	"manage_hash" text NOT NULL,
	"created_at" bigint NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	FOREIGN KEY ("tenant_id","branch_id") REFERENCES ritual."branches"("tenant_id","id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("tenant_id","barber_id") REFERENCES ritual."barbers"("tenant_id","id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("tenant_id","service_id") REFERENCES ritual."services"("tenant_id","id") ON UPDATE no action ON DELETE no action,
	CONSTRAINT "booking_window_valid" CHECK("bookings"."start_at" < "bookings"."end_at" AND "bookings"."busy_until" >= "bookings"."end_at"),
	CONSTRAINT "booking_status_valid" CHECK("bookings"."status" IN ('confirmed','arrived','in_progress','completed','cancelled','no_show'))
);

CREATE UNIQUE INDEX "bookings_reference_unique" ON ritual."bookings" ("reference");

CREATE UNIQUE INDEX "bookings_manage_hash_unique" ON ritual."bookings" ("manage_hash");

CREATE INDEX "booking_calendar" ON ritual."bookings" ("tenant_id","branch_id","start_at");

CREATE INDEX "booking_barber" ON ritual."bookings" ("tenant_id","barber_id","start_at");

CREATE TABLE ritual."notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"booking_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'not_configured' NOT NULL,
	"due_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	FOREIGN KEY ("tenant_id") REFERENCES ritual."tenants"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("booking_id") REFERENCES ritual."bookings"("id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX "notification_booking_kind" ON ritual."notifications" ("booking_id","kind");

CREATE TABLE ritual."audit" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	FOREIGN KEY ("tenant_id") REFERENCES ritual."tenants"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE ritual."rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window" bigint NOT NULL,
	"count" bigint NOT NULL
);

-- App tables are in the private ritual schema. The web application authorizes each request.
ALTER TABLE ritual.bookings ADD CONSTRAINT bookings_no_overlap EXCLUDE USING gist
 (tenant_id WITH =,barber_id WITH =,int8range(start_at,busy_until,'[)') WITH &&) WHERE (status<>'cancelled');
ALTER TABLE ritual.shifts ADD CONSTRAINT shifts_no_overlap EXCLUDE USING gist
 (tenant_id WITH =,barber_id WITH =,int8range(start_at,end_at,'[)') WITH &&);

CREATE FUNCTION ritual.booking_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=ritual,pg_catalog AS $$
DECLARE transfer bigint;
BEGIN
 IF NEW.status='cancelled' THEN RETURN NEW; END IF;
 -- Booking and shift writes share the same employee locks, ordered for moves.
 IF TG_OP='UPDATE' THEN
  PERFORM 1 FROM barbers WHERE (tenant_id,id) IN ((NEW.tenant_id,NEW.barber_id),(OLD.tenant_id,OLD.barber_id)) ORDER BY tenant_id,id FOR UPDATE;
 ELSE
  PERFORM 1 FROM barbers WHERE tenant_id=NEW.tenant_id AND id=NEW.barber_id FOR UPDATE;
 END IF;
 SELECT transfer_minutes*60000 INTO transfer FROM tenants WHERE id=NEW.tenant_id;
 IF EXISTS(SELECT 1 FROM bookings b WHERE b.id<>NEW.id AND b.tenant_id=NEW.tenant_id AND b.barber_id=NEW.barber_id AND b.status<>'cancelled'
  AND NEW.start_at<b.busy_until+CASE WHEN b.branch_id<>NEW.branch_id THEN transfer ELSE 0 END
  AND NEW.busy_until>b.start_at-CASE WHEN b.branch_id<>NEW.branch_id THEN transfer ELSE 0 END)
 THEN RAISE EXCEPTION 'BOOKING_CONFLICT' USING ERRCODE='23P01'; END IF;
 IF NOT EXISTS(SELECT 1 FROM shifts s WHERE s.tenant_id=NEW.tenant_id AND s.barber_id=NEW.barber_id AND s.branch_id=NEW.branch_id
  AND s.start_at<=NEW.start_at AND s.end_at>=NEW.busy_until
  AND(s.break_start IS NULL OR NEW.start_at>=s.break_end OR NEW.busy_until<=s.break_start))
 THEN RAISE EXCEPTION 'BOOKING_OUTSIDE_SHIFT'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER booking_guard BEFORE INSERT OR UPDATE OF start_at,end_at,busy_until,barber_id,branch_id,status ON ritual.bookings FOR EACH ROW EXECUTE FUNCTION ritual.booking_guard();

CREATE FUNCTION ritual.shift_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=ritual,pg_catalog AS $$
DECLARE transfer bigint;
BEGIN
 IF TG_OP='DELETE' THEN
  PERFORM 1 FROM barbers WHERE tenant_id=OLD.tenant_id AND id=OLD.barber_id FOR UPDATE;
 ELSE
  IF TG_OP='UPDATE' THEN
   PERFORM 1 FROM barbers WHERE (tenant_id,id) IN ((NEW.tenant_id,NEW.barber_id),(OLD.tenant_id,OLD.barber_id)) ORDER BY tenant_id,id FOR UPDATE;
  ELSE
   PERFORM 1 FROM barbers WHERE tenant_id=NEW.tenant_id AND id=NEW.barber_id FOR UPDATE;
  END IF;
  SELECT transfer_minutes*60000 INTO transfer FROM tenants WHERE id=NEW.tenant_id;
  IF EXISTS(SELECT 1 FROM shifts s WHERE s.id<>NEW.id AND s.tenant_id=NEW.tenant_id AND s.barber_id=NEW.barber_id
   AND NEW.start_at<s.end_at+CASE WHEN s.branch_id<>NEW.branch_id THEN transfer ELSE 0 END
   AND NEW.end_at>s.start_at-CASE WHEN s.branch_id<>NEW.branch_id THEN transfer ELSE 0 END)
  THEN RAISE EXCEPTION 'SHIFT_CONFLICT' USING ERRCODE='23P01'; END IF;
 END IF;
 IF TG_OP IN ('UPDATE','DELETE') THEN
  IF EXISTS(SELECT 1 FROM bookings b WHERE b.tenant_id=OLD.tenant_id AND b.barber_id=OLD.barber_id AND b.branch_id=OLD.branch_id
   AND b.status<>'cancelled' AND b.start_at>=OLD.start_at AND b.busy_until<=OLD.end_at
   AND (TG_OP='DELETE' OR NEW.tenant_id<>OLD.tenant_id OR NEW.barber_id<>OLD.barber_id OR NEW.branch_id<>OLD.branch_id
    OR b.start_at<NEW.start_at OR b.busy_until>NEW.end_at
    OR(NEW.break_start IS NOT NULL AND b.start_at<NEW.break_end AND b.busy_until>NEW.break_start)))
  THEN RAISE EXCEPTION 'SHIFT_HAS_BOOKINGS'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER shift_guard BEFORE INSERT OR UPDATE OR DELETE ON ritual.shifts FOR EACH ROW EXECUTE FUNCTION ritual.shift_guard();

CREATE FUNCTION ritual.transfer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=ritual,pg_catalog AS $$
BEGIN
 IF NEW.transfer_minutes>OLD.transfer_minutes THEN
  PERFORM 1 FROM barbers WHERE tenant_id=NEW.id ORDER BY id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM shifts a JOIN shifts b ON a.tenant_id=b.tenant_id AND a.barber_id=b.barber_id AND a.branch_id<>b.branch_id AND a.id<b.id
   WHERE a.tenant_id=NEW.id AND a.start_at<b.end_at+NEW.transfer_minutes*60000 AND a.end_at>b.start_at-NEW.transfer_minutes*60000)
  THEN RAISE EXCEPTION 'SHIFT_CONFLICT'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER transfer_guard BEFORE UPDATE OF transfer_minutes ON ritual.tenants FOR EACH ROW EXECUTE FUNCTION ritual.transfer_guard();

-- No browser/API key has access to operational tables. All data access is server-side.
DO $$ DECLARE tab record; BEGIN
 FOR tab IN SELECT tablename FROM pg_tables WHERE schemaname='ritual' LOOP
  EXECUTE format('ALTER TABLE ritual.%I ENABLE ROW LEVEL SECURITY',tab.tablename);
 END LOOP;
END $$;
REVOKE ALL ON SCHEMA ritual FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA ritual FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ritual FROM PUBLIC;

COMMIT;
