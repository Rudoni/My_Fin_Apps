BEGIN;

-- Corrige les dates achat-revente saisies avant 2020.
-- On conserve le mois / jour et on force l'annee a 2023
-- pour purchase_date et sale_date, chacune independamment.

UPDATE resale_item
SET purchase_date = MAKE_DATE(2023, EXTRACT(MONTH FROM purchase_date)::int, EXTRACT(DAY FROM purchase_date)::int)
WHERE purchase_date IS NOT NULL
  AND purchase_date < DATE '2020-01-01';

UPDATE resale_item
SET sale_date = MAKE_DATE(2023, EXTRACT(MONTH FROM sale_date)::int, EXTRACT(DAY FROM sale_date)::int)
WHERE sale_date IS NOT NULL
  AND sale_date < DATE '2020-01-01';

COMMIT;
