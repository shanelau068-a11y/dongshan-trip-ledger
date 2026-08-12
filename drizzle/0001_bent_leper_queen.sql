CREATE INDEX `idx_expenses_family_id` ON `expenses` (`family_id`);--> statement-breakpoint
CREATE INDEX `idx_expenses_date_id` ON `expenses` (`expense_date`,`id`);