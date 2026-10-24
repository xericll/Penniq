-- Amounts were stored with two decimals. The Kuwaiti, Bahraini, Jordanian, Tunisian and Libyan
-- dinar and the Omani rial count in thousandths, so a third decimal is kept. Existing values
-- only gain a trailing zero.

alter table public.transactions alter column amount type numeric(15, 3);
alter table public.user_settings alter column budget type numeric(15, 3);
