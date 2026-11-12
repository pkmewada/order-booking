$(document).ready(function () {
    "use strict";

    let pieceItems = [];
    let selectedIds = [];

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showPageError(message) {
        $("#patternPageMessage").text(message).removeClass("d-none");
    }

    async function loadPatterns() {
        const patterns = await CatalogApi.request("patterns");
        const tbody = $("#patternTableBody").empty();
        if (!patterns.length) {
            tbody.append('<tr><td colspan="3" class="text-center text-muted">No patterns created yet.</td></tr>');
            return;
        }
        patterns.forEach((pattern, index) => {
            const names = (pattern.items || []).map(item => item.name);
            tbody.append(`
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(pattern.name)}</td>
                    <td>${escapeHtml(names.join(", "))} <span class="text-muted">(${pattern.pieceCount} Piece)</span></td>
                </tr>
            `);
        });
    }

    function currentSelection() {
        return selectedIds
            .map(id => pieceItems.find(item => String(item.id) === String(id)))
            .filter(Boolean);
    }

    function updateSummary() {
        const selected = currentSelection();
        const name = selected.length
            ? `${selected.map(item => item.name).join(" ")} ${selected.length} Piece`
            : "";
        $("#patternName").val(name);
        $("#patternSelectionSummary").text(
            selected.length
                ? `${selected.length} piece${selected.length === 1 ? "" : "s"} selected in click order.`
                : "Select at least one Piece Item."
        );
        $("#savePatternBtn").prop("disabled", selected.length === 0 || selected.length > 255 || name.length > 150);
        $("#patternModalMessage").text(name.length > 150 ? "Pattern name is longer than 150 characters. Shorten it before saving." : "");
    }

    async function openPatternModal() {
        $("#patternModalMessage").text("");
        $("#pieceItemChoices").empty();
        $("#patternName").val("");
        selectedIds = [];
        try {
            pieceItems = await CatalogApi.request("piece-item-list");
            if (!pieceItems.length) {
                $("#pieceItemChoices").html('<div class="col-12 text-muted">Add Piece Items first, then create a pattern.</div>');
            } else {
                pieceItems.forEach(item => {
                    $("#pieceItemChoices").append(`
                        <div class="col-sm-6 col-md-4">
                            <label class="form-check border rounded p-2 w-100">
                                <input class="form-check-input pattern-piece-choice" type="checkbox" value="${escapeHtml(item.id)}">
                                <span class="form-check-label ms-1">${escapeHtml(item.name)}</span>
                                <span class="pattern-piece-order badge bg-secondary ms-1 d-none"></span>
                            </label>
                        </div>
                    `);
                });
            }
            updateSummary();
            $("#patternModal").modal("show");
        } catch (error) {
            showPageError(error.message || "Unable to load Piece Items.");
        }
    }

    $(document).on("change", ".pattern-piece-choice", function () {
        const id = String($(this).val());
        if (this.checked) {
            if (selectedIds.length >= 255) {
                this.checked = false;
                $("#patternModalMessage").text("A pattern can contain up to 255 pieces.");
                return;
            }
            selectedIds.push(id);
        } else {
            selectedIds = selectedIds.filter(selectedId => selectedId !== id);
        }
        $("#patternModalMessage").text("");
        selectedIds.forEach((selectedId, index) => {
            const $choice = $(`.pattern-piece-choice[value="${selectedId}"]`);
            $choice.closest("label").find(".pattern-piece-order").text(index + 1).removeClass("d-none");
        });
        $(".pattern-piece-choice").not(":checked").closest("label").find(".pattern-piece-order").addClass("d-none");
        updateSummary();
    });

    $("#addPatternBtn").on("click", openPatternModal);

    $("#savePatternBtn").on("click", async function () {
        const selected = currentSelection();
        const name = String($("#patternName").val() || "").trim();
        if (!selected.length || !name || name.length > 150) {
            $("#patternModalMessage").text("Select Piece Items and enter a pattern name up to 150 characters.");
            return;
        }
        const button = $(this).prop("disabled", true);
        try {
            await CatalogApi.request("patterns", {
                name,
                pieceItemIds: selected.map(item => Number(item.id))
            });
            await loadPatterns();
            $("#patternModal").modal("hide");
        } catch (error) {
            $("#patternModalMessage").text(error.message || "Could not save this pattern.");
        } finally {
            button.prop("disabled", currentSelection().length === 0);
        }
    });

    loadPatterns().catch(error => showPageError(error.message || "Unable to load patterns."));
});
