# OrderAudit -- 8-minute Demo Script

## 0:00--0:40 \| Introduction

"Hello. This is OrderAudit, an Order-to-Audit Manufacturing ERP
prototype for a small packaged-food manufacturer. It connects purchases,
inventory, production, sales invoices, customer collections and reports
in one application. I will demonstrate the Murukku 200 g benchmark."

## 0:40--1:30 \| Master data and BOM

"Here is the Murukku product and its Bill of Materials. One standard
batch plans 200 packets. The BOM contains flour, cooking oil, salt and
spice mix, packaging pouches and cartons. The system uses units such as
kilograms, litres and pieces so different materials are not mixed into
one unit."

## 1:30--2:10 \| Purchase and inventory receipt

"Next, the factory records a purchase of 60 kg of flour at ₹45 per kg,
giving a purchase value of ₹2,700. The stock ledger records the receipt
and the stock summary reflects the new balance."

## 2:10--3:30 \| Production run

"The production supervisor records run PROD-001. Planned output is 200
packets. Actual consumption is 40 kg flour, 10.5 litres oil, 1.2 kg
spice, 194 pouches and 9 cartons. Good output is 188 packets. The
backend validates that each BOM material is supplied once, checks
available stock, records consumption and adds good finished output to
stock."

## 3:30--4:20 \| Production variance

"The production report shows 188 good packets against 200 planned, a
yield variance of minus 6%. Material-wise, oil consumption is 5% above
plan. Pouch consumption is 3% below plan and carton consumption is 10%
below plan. The report shows the planned quantity, actual quantity,
quantity variance, percentage variance and unit."

## 4:20--5:30 \| Sales invoice and dispatch

"Retailer A orders 150 packets. The benchmark invoice has taxable value
₹7,500. With the exercise GST assumption of 5%, CGST is ₹187.50 and SGST
is ₹187.50, making the invoice total ₹7,875. Dispatch reduces finished
stock by 150 packets."

## 5:30--6:10 \| Payment and outstanding

"Retailer A pays ₹4,000. The outstanding balance is ₹3,875, calculated
as invoice total minus payment received."

## 6:10--7:20 \| Reports and exports

"The Reports workspace contains Sales Register, GST Summary, Purchase
Register, Stock Summary, Stock Ledger, Production and Payments &
Outstanding. I have tested CSV exports for all seven tabs. These exports
provide records for review and reconciliation."

## 7:20--8:00 \| Closing and limitations

"To summarize, the benchmark shows flour closing stock of 120 kg, oil
19.5 litres, spice 3.8 kg, pouches 306 pieces, cartons 21 pieces and
finished Murukku 88 packets after dispatch. The prototype demonstrates
linked operational records and reporting. The 5% GST rate is an exercise
assumption, and production deployment would require further security,
compliance, costing and deployment validation. Thank you."
