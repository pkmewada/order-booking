/* Small shared additions to the existing assignment tables and progress modal. */
(function () {
    "use strict";
    window.installProductionControls = function (key, refresh) {
        const tables = $("#cuttingMastersList, #assignedList, #inhouseList, #outsourceList");
        function install() {
            tables.each(function () {
                const table = $(this).closest("table");
                if (!table.prev(".production-bulk-controls").length) {
                    table.before('<div class="production-bulk-controls d-flex gap-2 mb-2"><button type="button" class="btn btn-sm btn-success production-bulk-pass">Pass selected</button><button type="button" class="btn btn-sm btn-warning production-bulk-damage">Damage selected</button></div>');
                }
                $(this).find(".progress-btn").each(function () {
                    if (!$(this).siblings(".production-select").length) $(this).before($('<input type="checkbox" class="form-check-input production-select" aria-label="Select assignment for bulk action">').attr("data-id", $(this).data("id")));
                });
            });
        }
        function selection(button) {
            return $(button).closest(".production-bulk-controls").next("table").find(".production-select:checked").toArray().map(el => Number($(el).data("id")));
        }
        $(document).on("click", ".production-bulk-pass", async function () {
            const ids = selection(this);
            if (!ids.length) return Swal.fire({ icon: "info", title: "Select assignments first" });
            const result = await Swal.fire({ title: `Pass ready quantity for ${ids.length} assignments?`, icon: "question", showCancelButton: true });
            if (!result.isConfirmed) return;
            try { await Production.pass(key, ids); refresh(); install(); }
            catch (error) { Swal.fire({ icon: "error", title: "Bulk pass cancelled", text: error.message }); }
        });
        $(document).on("click", ".production-bulk-damage", async function () {
            const ids = selection(this);
            if (!ids.length) return Swal.fire({ icon: "info", title: "Select assignments first" });
            const result = await Swal.fire({ title: "Add damage to selected assignments", text: "Enter assignment ID: additional damage on each line. All rows save together.",
                input: "textarea", inputValue: ids.map(id => `${id}: 0`).join("\n"), showCancelButton: true });
            if (!result.isConfirmed) return;
            try {
                const rows = String(result.value).trim().split(/\r?\n/).map(line => {
                    const match = line.match(/^\s*(\d+)\s*:\s*(\d+)\s*$/);
                    if (!match || !ids.includes(Number(match[1]))) throw new Error("Use one selected assignment ID and a whole damage quantity per line.");
                    return { id: Number(match[1]), addDamage: Number(match[2]) };
                });
                if (rows.length !== ids.length || new Set(rows.map(r=>r.id)).size !== ids.length) throw new Error("Every selected assignment must appear exactly once.");
                await Production.edit(key,rows); refresh(); install();
            } catch(error) { Swal.fire({ icon: "error", title: "Bulk damage cancelled", text: error.message }); }
        });
        tables.each(function () { new MutationObserver(install).observe(this, { childList: true }); });
        install();
    };
})();
