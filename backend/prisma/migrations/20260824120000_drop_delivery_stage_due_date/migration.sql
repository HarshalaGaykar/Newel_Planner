-- Delivery Tracker: the Stage Due Date field is removed entirely. Superseded-date
-- strike-through now lives on Planned End Date and Actual End Date instead.
--
-- Existing "Stage Due Date" rows in DeliveryItemHistory are deliberately kept:
-- they are an audit trail of past edits and simply stop being rendered.
ALTER TABLE "DeliveryItem" DROP COLUMN "stageDueDate";
