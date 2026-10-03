CREATE TABLE `attachment_files` (
	`attachment_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`state` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`deleted_at` text,
	`server_seq` integer,
	`transaction_id` text NOT NULL,
	`storage_path` text NOT NULL,
	`content_type` text DEFAULT 'image/jpeg' NOT NULL,
	`size_bytes` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attachments_transaction_idx` ON `attachments` (`transaction_id`);