CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`peer0` text NOT NULL,
	`peer1` text NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `matches_expiry` ON `matches` (`expires`);--> statement-breakpoint
CREATE TABLE `match_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`joined` integer NOT NULL,
	`seen` integer NOT NULL,
	`loadout` text NOT NULL,
	`match_id` text
);
--> statement-breakpoint
CREATE INDEX `tickets_queue` ON `match_tickets` (`match_id`,`seen`);