BEGIN;

-- Corrige les lignes achat-revente vendues avant 2020.
-- On conserve le mois / jour, et on force l'annee a 2024
-- pour sale_date et purchase_date sur ces lignes.

UPDATE resale_item
SET
    sale_date = MAKE_DATE(2024, EXTRACT(MONTH FROM sale_date)::int, EXTRACT(DAY FROM sale_date)::int),
    purchase_date = CASE
        WHEN purchase_date IS NOT NULL
            THEN MAKE_DATE(2024, EXTRACT(MONTH FROM purchase_date)::int, EXTRACT(DAY FROM purchase_date)::int)
        ELSE NULL
    END
WHERE sale_date IS NOT NULL
  AND sale_date < DATE '2020-01-01';

COMMIT;
