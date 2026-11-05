-- Final concurrency guard: overlapping writes fail atomically inside SQLite/D1.
CREATE TRIGGER booking_insert_guard BEFORE INSERT ON bookings WHEN NEW.status <> 'cancelled' BEGIN
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM bookings b JOIN tenants t ON t.id=NEW.tenant_id
  WHERE b.tenant_id=NEW.tenant_id AND b.barber_id=NEW.barber_id AND b.status<>'cancelled'
   AND NEW.start_at < b.busy_until + CASE WHEN b.branch_id<>NEW.branch_id THEN t.transfer_minutes*60000 ELSE 0 END
   AND NEW.busy_until > b.start_at - CASE WHEN b.branch_id<>NEW.branch_id THEN t.transfer_minutes*60000 ELSE 0 END
 ) THEN RAISE(ABORT,'BOOKING_CONFLICT') END;
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM shifts s WHERE s.tenant_id=NEW.tenant_id AND s.barber_id=NEW.barber_id AND s.branch_id=NEW.branch_id
   AND s.start_at<=NEW.start_at AND s.end_at>=NEW.busy_until
   AND (s.break_start IS NULL OR NEW.start_at>=s.break_end OR NEW.busy_until<=s.break_start)
 ) THEN RAISE(ABORT,'BOOKING_OUTSIDE_SHIFT') END;
END;
--> statement-breakpoint
CREATE TRIGGER booking_update_guard BEFORE UPDATE OF start_at,end_at,busy_until,barber_id,branch_id,status ON bookings WHEN NEW.status <> 'cancelled' BEGIN
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM bookings b JOIN tenants t ON t.id=NEW.tenant_id
  WHERE b.id<>NEW.id AND b.tenant_id=NEW.tenant_id AND b.barber_id=NEW.barber_id AND b.status<>'cancelled'
   AND NEW.start_at < b.busy_until + CASE WHEN b.branch_id<>NEW.branch_id THEN t.transfer_minutes*60000 ELSE 0 END
   AND NEW.busy_until > b.start_at - CASE WHEN b.branch_id<>NEW.branch_id THEN t.transfer_minutes*60000 ELSE 0 END
 ) THEN RAISE(ABORT,'BOOKING_CONFLICT') END;
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM shifts s WHERE s.tenant_id=NEW.tenant_id AND s.barber_id=NEW.barber_id AND s.branch_id=NEW.branch_id
   AND s.start_at<=NEW.start_at AND s.end_at>=NEW.busy_until
   AND (s.break_start IS NULL OR NEW.start_at>=s.break_end OR NEW.busy_until<=s.break_start)
 ) THEN RAISE(ABORT,'BOOKING_OUTSIDE_SHIFT') END;
END;
--> statement-breakpoint
CREATE TRIGGER shift_insert_guard BEFORE INSERT ON shifts BEGIN
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM shifts s JOIN tenants t ON t.id=NEW.tenant_id
  WHERE s.tenant_id=NEW.tenant_id AND s.barber_id=NEW.barber_id
   AND NEW.start_at < s.end_at + CASE WHEN s.branch_id<>NEW.branch_id THEN t.transfer_minutes*60000 ELSE 0 END
   AND NEW.end_at > s.start_at - CASE WHEN s.branch_id<>NEW.branch_id THEN t.transfer_minutes*60000 ELSE 0 END
 ) THEN RAISE(ABORT,'SHIFT_CONFLICT') END;
END;
--> statement-breakpoint
CREATE TRIGGER shift_update_guard BEFORE UPDATE ON shifts BEGIN
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM shifts s JOIN tenants t ON t.id=NEW.tenant_id
  WHERE s.id<>NEW.id AND s.tenant_id=NEW.tenant_id AND s.barber_id=NEW.barber_id
   AND NEW.start_at < s.end_at + CASE WHEN s.branch_id<>NEW.branch_id THEN t.transfer_minutes*60000 ELSE 0 END
   AND NEW.end_at > s.start_at - CASE WHEN s.branch_id<>NEW.branch_id THEN t.transfer_minutes*60000 ELSE 0 END
 ) THEN RAISE(ABORT,'SHIFT_CONFLICT') END;
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM bookings b WHERE b.tenant_id=OLD.tenant_id AND b.barber_id=OLD.barber_id AND b.branch_id=OLD.branch_id
   AND b.status<>'cancelled' AND b.start_at>=OLD.start_at AND b.busy_until<=OLD.end_at
   AND (NEW.tenant_id<>OLD.tenant_id OR NEW.barber_id<>OLD.barber_id OR NEW.branch_id<>OLD.branch_id OR b.start_at<NEW.start_at OR b.busy_until>NEW.end_at
    OR (NEW.break_start IS NOT NULL AND b.start_at<NEW.break_end AND b.busy_until>NEW.break_start))
 ) THEN RAISE(ABORT,'SHIFT_HAS_BOOKINGS') END;
END;
--> statement-breakpoint
CREATE TRIGGER shift_delete_guard BEFORE DELETE ON shifts BEGIN
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM bookings b WHERE b.tenant_id=OLD.tenant_id AND b.barber_id=OLD.barber_id AND b.branch_id=OLD.branch_id
   AND b.status<>'cancelled' AND b.start_at>=OLD.start_at AND b.busy_until<=OLD.end_at
 ) THEN RAISE(ABORT,'SHIFT_HAS_BOOKINGS') END;
END;
