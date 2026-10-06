-- Find empty duplicate timesheets and delete them
DELETE FROM "Timesheet"
WHERE id IN (
  SELECT t1.id
  FROM "Timesheet" t1
  JOIN "Timesheet" t2 
    ON t1."userId" = t2."userId"
    AND DATE(t1."startDate") = DATE(t2."startDate") 
    AND t1.id != t2.id
  LEFT JOIN "TimesheetEntry" e ON t1.id = e."timesheetId"
  WHERE e.id IS NULL
);
