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
