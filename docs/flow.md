# Application flow and database register

Keep this document and the SQL schema updated whenever APIs or tables change. All new table names must use lower camelCase, such as `customerOrders`, `orderItems`, `deliveryBatches`. Existing single-word names remain unchanged. Database: `order-booking`.

## Database-connected order booking masters

Form → browser validation → separate PHP API → shared `api/master-records.php` → PDO connection in `includes/db.php` → MySQL → JSON response → list update and success message. Failed requests show errors, not success. GET lists, POST creates, PUT edits and DELETE removes records.

| Page | API | Table | ID prefix |
| --- | --- | --- | --- |
| settings/agent.php | api/agent.php | agents | AGT |
| settings/distributor.php | api/distributor.php | distributors | DIS |
| settings/transporter.php | api/transporter.php | transporters | TRN |
| orderBooking/customerCreation.php | api/customer.php | customerRecords | CUS |

Each table has `id`, `name`, `contact`, `email`, `city`, `state`, `createdAt`, `updatedAt`. Name, city, state and phone are required. Phone must match `^[6-9][0-9]{9}$`: exactly 10 digits starting with 6, 7, 8 or 9. Country codes, spaces and letters are rejected.

Email is optional. Supplied emails are syntax-validated, trimmed and lowercased. Emails are unique within each table, enforced by API validation and the database `uniqueEmail` index. Editing a record may keep its own email. Different master types may share an email. Blank emails are stored as NULL, so multiple records may omit email. Mailbox existence/ownership is not verified.

Management pages load records from the database and maintain a localStorage compatibility cache for existing customer/order screens. Existing browser-only records are not automatically uploaded. Existing invalid phone records are not rewritten; future saves must satisfy validation.

## SQL setup and updates

- New installation: import `database/order-booking.sql` using phpMyAdmin. Creates the database and three tables with unique email indexes.
- Fresh database setup uses only `database/order-booking.sql`; there is no separate migration file. Each table includes the phone constraint and unique email index.
- Configure connection defaults in `includes/db.php`, or use its DB environment variables. XAMPP defaults: `127.0.0.1:3306`, `root`, blank password.

## Remaining order booking flow

Master selection → customer creation → product creation/BOM import → order punch with customer/items/sets → active order list → passed order summary → dispatch with item details → each partial dispatch pass creates a separate delivery → delivery In Progress → Pass with PDF upload → that delivery Success and PDF available for download.

Customer records now use the database through `api/customer.php`. Products and BOM records now share database persistence. Orders, dispatch and delivery metadata still use existing browser storage. Delivery PDF files use IndexedDB. Orders/dispatch/delivery do not yet have database APIs/tables. The three master management pages refresh their cached dropdown records for the current browser.

## Existing manufacturing flow

BOM → batch creation/approval → configured production route: cutting, additional work (embroidery, digital print, screen print, hand work, peco), stitching, ironing → packing → bundling → inventory/stock.

The production engine determines each batch/piece's applicable stages, assignments, completed quantities, damage, repairs and onward availability. Navbar counts distinguish unassigned and assigned work. Stage progress updates offer Completed/Damage; passed batch lists require the relevant batch assignments to be passed. Batch History provides PDF export. Manufacturing persistence remains in the existing browser-based production engine; Manufacturing master pages now use separate database APIs for employee, colour, item and additional work records.

## Change log

| Date | Update |
| --- | --- |
| 2026-10-07 | Added separate master APIs, PDO connection and three master tables. |
| 2026-10-07 | Added strict mobile validation, optional validated email, unique email per master table and schema migration. New table names use lower camelCase. |

## Customer creation database flow

Customer page loads customers plus agents, transporters and distributors directly from their separate APIs. Dropdown labels come from SQL master lists. Existing table columns and QR/edit/delete actions are preserved. Add/edit sends name, shopName, contact, email, city, state, agentId, transporterId and distributorId to `api/customer.php`; the shared handler validates and saves to `customerRecords`. Name/shopName/phone are required. City/state and master selections retain their existing optional behavior. Phone has the same 10-digit 6?9 rule. Email is optional, format-validated and unique within customers; blank email is NULL. Selected master IDs must exist. Foreign keys prevent deleting master rows linked to customers until those customer links are changed.

The customer page refreshes a localStorage compatibility cache for existing order-punch and QR lookup. Old browser-only customers are not automatically uploaded. Customer SQL definition is included in the single `database/order-booking.sql`; re-import it to add the new table to an existing current database without dropping the master tables. SQL import has not been executed against MySQL here.

## Manufacturing master table register

The single `database/order-booking.sql` now contains these four additional tables. Names and new columns use lower camelCase. Tables follow the current forms; no extra contact/email fields were added.

| Master page | SQL table | Fields | Rules |
| --- | --- | --- | --- |
| Employee (empolyee.php) | employeeRecords | id, name, category, employeeType, createdAt, updatedAt | String worker ID; unique name; category cutting/stitching/ironing; type housein/outsource. |
| Colour (settings/colour.php) | colourRecords | id, name, createdAt, updatedAt | Auto-increment numeric ID; unique name. |
| Additional Work (settings/additionalWork.php) | additionalWork | id, name, createdAt, updatedAt | Auto-increment numeric ID; unique name. |
| Item List (settings/itemList.php) | itemList | id, name, createdAt, updatedAt | Auto-increment numeric ID; unique name. |

Current page behavior: All four pages load from MySQL and save/delete through separate APIs. Hardcoded sample lists and employee sample initialization have been removed. Tables start empty; old sample/browser data is not automatically imported. A database-backed compatibility cache replaces old browser lists after a successful load. Re-import order-booking.sql to create missing tables without dropping existing tables or data. Manufacturing assignments and production tracking remain in the existing production engine.

| Date | Update |
| --- | --- |
| 2026-10-07 | Added employeeRecords, colourRecords, additionalWork and itemList SQL tables. |

## Manufacturing master API flow

Page ? GET separate API ? MySQL list ? render. Add/edit ? validate name (and category/type for employees) ? POST/PUT API ? prepared database write ? update list/cache and show success. Delete ? DELETE API ? database removal ? update list. Errors leave the record and form intact. Search, filters and existing button styles remain. Names are unique within each table.

| Master | API | Database table |
| --- | --- | --- |
| Employee | api/employee.php | employeeRecords |
| Colour | api/colour.php | colourRecords |
| Item List | api/item-list.php | itemList |
| Additional Work | api/additional-work.php | additionalWork |

Shared handler: `api/manufacturing-records.php`. Employee IDs are generated WRK strings; other IDs are database-generated integers. Colour retains its existing add/delete UI; other masters retain edit. No old records are uploaded automatically and no existing SQL data is deleted. SQL definitions remain in the single `database/order-booking.sql`. Manufacturing assignment/production storage remains unchanged.

## Shared BOM Master / Product Creation catalog

Both screens use ONE main table, `productRecords`. `createdFrom` records whether the original creation was from BOM (`bom`) or Product Creation (`product`); completing/importing a record preserves its origin. `inProductList` controls Product List visibility. `bomCompleted` distinguishes the three-field product draft from a fully configured BOM. Every database row appears once in BOM Master; Product List shows only rows with inProductList enabled.

| Table | Purpose / fields |
| --- | --- |
| productRecords | id, brand, numeric designNumber, colourId, pattern, mrp, photo, pieces, pieceCount, createdFrom, inProductList, bomCompleted, status, createdAt, updatedAt |
| productItemLinks | Foreign keys to productRecords and itemList; pieceNumber and role (piece/material). |
| productWorkSteps | Ordered work instances with foreign keys to productRecords and additionalWork; pieceNumber, workOrder and stage. Repeated work names are separate rows. |

The item link table and ordered work-step table enforce real foreign keys for multiple items/work entries; they are not separate BOM/product main tables. The older `productWorkLinks` table remains for compatibility with existing installations. Colour has a direct foreign key to colourRecords. All table definitions are in the single database/order-booking.sql. Re-import the updated SQL to create the ordered work-step table without dropping existing master data.

APIs: api/bom.php and api/product.php, shared implementation api/product-records.php. GET lists from SQL. POST saves, changes active/inactive status, or imports. DELETE removes the shared record, its item/work links and its uploaded photo. Import Selected enables Product List visibility on the same existing complete/active BOM rows; it does not duplicate records.

Product Creation starts with brand, numeric design number and Colour dropdown. Its row appears In Progress in BOM Master until full details are saved there. BOM creation stores all piece/item/material/work details and becomes Completed. Product editing preserves those BOM details. Brand choices and automatic sizes/barcodes remain unchanged. Design number is 1?18 digits stored as BIGINT (leading zeros are normalized), unique across the shared catalog. Pattern accepts letters/spaces; MRP is optional, non-negative with two decimal places.

Colour options come only from colourRecords. Piece item and material choices come only from itemList. Work choices come only from additionalWork. Old hardcoded dropdown lists and browser-only catalog records are not imported or rendered. Foreign keys prevent deleting a master referenced by catalog records. Lists resolve current master names from SQL, including renamed items/works/colours.

Photo upload accepts JPEG/PNG/WebP, maximum 5 MB. Server generates a random filename under uploads/products; database stores its relative path. Replacing an image removes the old file after the save commits. Failed saves remove newly uploaded files. Deleting from either screen deletes the shared row and photo. Folder rules disable listing/script access.

Browser localStorage receives a compatibility cache after catalog load for existing production/order consumers; catalog saves are authoritative in MySQL. Manufacturing production/order transactions remain otherwise unchanged. Verification: PHP/JS syntax checks; live database import/upload flow has not been executed here.
# Item master configuration

Item List entries have a user-selected `Cutting` or `Non-Cutting` type. Existing entries remain unconfigured until an operator edits them. New BOM material links require configured Item List records. Garment pieces continue to use the existing `pieceItemList` catalog and stable `pieceItemId` references; the item catalog and piece catalog are distinct in the current implementation.

The BOM flow editor loads work names from `additionalWork`. It allows up to five parallel works after Cutting and one sequential work after Stitching and after Ironing; each selected position is stored on its ordered `productWorkSteps` row.
