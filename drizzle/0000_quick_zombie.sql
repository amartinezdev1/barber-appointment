CREATE TABLE `access_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`branch_ids` text DEFAULT '[]' NOT NULL,
	`barber_id` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`barber_id`) REFERENCES `barbers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grant_tenant_email` ON `access_grants` (`tenant_id`,`email`);--> statement-breakpoint
CREATE TABLE `app_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `barber_services` (
	`tenant_id` text NOT NULL,
	`barber_id` text NOT NULL,
	`service_id` text NOT NULL,
	`minutes` integer,
	`price_cents` integer,
	PRIMARY KEY(`tenant_id`, `barber_id`, `service_id`),
	FOREIGN KEY (`tenant_id`,`barber_id`) REFERENCES `barbers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`service_id`) REFERENCES `services`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `barbers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`initials` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `barber_tenant_id` ON `barbers` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`barber_id` text NOT NULL,
	`service_id` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`busy_until` integer NOT NULL,
	`client_name` text NOT NULL,
	`client_phone` text NOT NULL,
	`client_email` text DEFAULT '' NOT NULL,
	`price_cents` integer NOT NULL,
	`minutes` integer NOT NULL,
	`service_name` text NOT NULL,
	`whatsapp_consent` integer DEFAULT 0 NOT NULL,
	`reference` text NOT NULL,
	`manage_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`tenant_id`,`branch_id`) REFERENCES `branches`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`barber_id`) REFERENCES `barbers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`service_id`) REFERENCES `services`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "booking_window_valid" CHECK("bookings"."start_at" < "bookings"."end_at" AND "bookings"."busy_until" >= "bookings"."end_at"),
	CONSTRAINT "booking_status_valid" CHECK("bookings"."status" IN ('confirmed','arrived','in_progress','completed','cancelled','no_show'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_reference_unique` ON `bookings` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_manage_hash_unique` ON `bookings` (`manage_hash`);--> statement-breakpoint
CREATE INDEX `booking_calendar` ON `bookings` (`tenant_id`,`branch_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `booking_barber` ON `bookings` (`tenant_id`,`barber_id`,`start_at`);--> statement-breakpoint
CREATE TABLE `branch_services` (
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`service_id` text NOT NULL,
	`minutes` integer,
	`price_cents` integer,
	PRIMARY KEY(`tenant_id`, `branch_id`, `service_id`),
	FOREIGN KEY (`tenant_id`,`branch_id`) REFERENCES `branches`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`service_id`) REFERENCES `services`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`timezone` text DEFAULT 'America/Panama' NOT NULL,
	`opens` integer DEFAULT 540 NOT NULL,
	`closes` integer DEFAULT 1140 NOT NULL,
	`closed_days` text DEFAULT '[0]' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "branch_hours" CHECK("branches"."opens" >= 0 AND "branches"."closes" <= 1440 AND "branches"."opens" < "branches"."closes")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branch_tenant_id` ON `branches` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`branch_ids` text DEFAULT '[]' NOT NULL,
	`barber_id` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`barber_id`) REFERENCES `barbers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_user_tenant` ON `memberships` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'not_configured' NOT NULL,
	`due_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_booking_kind` ON `notifications` (`booking_id`,`kind`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`is_platform_admin` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`minutes` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`buffer_minutes` integer DEFAULT 5 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "service_values" CHECK("services"."minutes" >= 5 AND "services"."minutes" <= 480 AND "services"."price_cents" >= 0 AND "services"."buffer_minutes" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_tenant_id` ON `services` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`barber_id` text NOT NULL,
	`date` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`break_start` integer,
	`break_end` integer,
	FOREIGN KEY (`tenant_id`,`branch_id`) REFERENCES `branches`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`barber_id`) REFERENCES `barbers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shift_window_valid" CHECK("shifts"."start_at" < "shifts"."end_at"),
	CONSTRAINT "shift_break_valid" CHECK(("shifts"."break_start" IS NULL AND "shifts"."break_end" IS NULL) OR ("shifts"."break_start" IS NOT NULL AND "shifts"."break_end" IS NOT NULL AND "shifts"."break_start" >= "shifts"."start_at" AND "shifts"."break_end" <= "shifts"."end_at" AND "shifts"."break_start" < "shifts"."break_end"))
);
--> statement-breakpoint
CREATE INDEX `shift_window` ON `shifts` (`tenant_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`tagline` text DEFAULT 'Un buen corte. Sin la espera.' NOT NULL,
	`accent` text DEFAULT '#c2ed86' NOT NULL,
	`hero_url` text DEFAULT '' NOT NULL,
	`timezone` text DEFAULT 'America/Panama' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`plan` text DEFAULT 'Esencial' NOT NULL,
	`transfer_minutes` integer DEFAULT 30 NOT NULL,
	`cancel_minutes` integer DEFAULT 120 NOT NULL,
	`notice_minutes` integer DEFAULT 30 NOT NULL,
	`advance_days` integer DEFAULT 60 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);
--> statement-breakpoint
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
