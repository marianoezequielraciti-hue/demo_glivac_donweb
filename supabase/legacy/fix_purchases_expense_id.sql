-- Desacoplar purchases de expenses
-- La columna expense_id ya no es obligatoria
ALTER TABLE purchases ALTER COLUMN expense_id DROP NOT NULL;

-- Si expense_id no existe en la tabla purchases, esta línea no hace nada dañino.
-- Si la columna no existe, el error es seguro de ignorar.
