CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`digest` text NOT NULL,
	`object_key` text NOT NULL,
	`uploader` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attachments_space` ON `attachments` (`space_id`);--> statement-breakpoint
CREATE TABLE `entries` (
	`space_id` text NOT NULL,
	`id` text NOT NULL,
	`sequence` integer NOT NULL,
	`kind` text NOT NULL,
	`case_id` text,
	`record` text NOT NULL,
	`hash` text NOT NULL,
	PRIMARY KEY(`space_id`, `id`),
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_sequence` ON `entries` (`space_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`envelope` text NOT NULL,
	`received_at` text NOT NULL,
	`receiver` text NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`digest` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`role` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_by` text,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trusted_keys` (
	`space_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`label` text NOT NULL,
	`domain` text NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`updated_at` text NOT NULL,
	`issuer` text NOT NULL,
	PRIMARY KEY(`space_id`, `fingerprint`),
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `members` (
	`space_id` text NOT NULL,
	`principal` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`space_id`, `principal`),
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `members_principal` ON `members` (`principal`);--> statement-breakpoint
CREATE TABLE `spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`purpose` text NOT NULL,
	`owner` text NOT NULL,
	`head` text NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`origin` text,
	`read_only` integer DEFAULT 0 NOT NULL
);
