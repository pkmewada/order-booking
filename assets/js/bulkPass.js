window.BulkPass = (() => {
    let saving = false;

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));

    function modalElement() {
        let element = document.getElementById('bulkPassModal');
        if (element) return element;
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal fade" id="bulkPassModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-fullscreen">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="bulkPassTitle"></h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info py-2">Enter completed quantities and any damage for each assignment, then save progress or pass all available completed quantities.</div>
                            <div class="table-responsive">
                                <table class="table table-bordered table-hover text-nowrap align-middle">
                                    <thead id="bulkPassHead"></thead>
                                    <tbody id="bulkPassRows"></tbody>
                                </table>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-dark" id="bulkPassSaveProgress"><i class="bx bx-save me-1"></i>Save Progress</button>
                            <button type="button" class="btn btn-dark" id="bulkPassSaveAndPass"><i class="bx bx-right-arrow-alt me-1"></i>Save &amp; Pass Ready</button>
                        </div>
                    </div>
                </div>
            </div>`);
        return document.getElementById('bulkPassModal');
    }

    function changesFor(rows, mode, showDamage) {
        const changes = [];
        let invalid = false;
        $('#bulkPassRows tr').each(function () {
            const row = $(this), id = String(row.data('id'));
            const completionInput = row.find('.bulk-pass-completed');
            const damageInput = row.find('.bulk-pass-damage');
            const completionValue = Number(completionInput.val());
            const damageValue = showDamage ? Number(damageInput.val()) : 0;
            const completion = Number.isSafeInteger(completionValue) && completionValue >= 0 ? completionValue : NaN;
            const damage = Number.isSafeInteger(damageValue) && damageValue >= 0 ? damageValue : NaN;
            if (!Number.isSafeInteger(completion) || !Number.isSafeInteger(damage)) {
                invalid = true;
                return;
            }
            const original = rows.find(item => String(item.id) === id);
            if (!original) return;
            const oldCompleted = Number(original.completed ?? 0);
            const oldDamage = Number(original.damage ?? 0);
            const quantity = Number(original.quantity ?? 0);
            if (mode === 'absolute') {
                if (completion < oldCompleted || completion + oldDamage > quantity) invalid = true;
            } else if (oldCompleted + completion + oldDamage + damage > quantity) {
                invalid = true;
            }
            const completedChanged = mode === 'absolute' ? completion !== oldCompleted : completion > 0;
            const damageChanged = showDamage && damage > 0;
            if (completedChanged || damageChanged) {
                changes.push({
                    id,
                    completed: mode === 'absolute' ? completion : completion,
                    damage,
                    completedChanged,
                    damageChanged
                });
            }
        });
        if (invalid) throw new Error("Enter whole quantities within each assignment's remaining amount.");
        return changes;
    }

    async function runPass(options, rows, mode, showDamage) {
        if (saving) return;
        saving = true;
        $('#bulkPassSaveProgress,#bulkPassSaveAndPass').prop('disabled', true);
        try {
            const changes = changesFor(rows, mode, showDamage);
            if (changes.length && !(await options.onSave(changes))) return;
            const passed = await options.onPass();
            if (!passed) return;
            bootstrap.Modal.getOrCreateInstance(modalElement()).hide();
        } catch (error) {
            await Swal.fire({ icon: 'error', title: 'Could not save bulk progress', text: error.message });
        } finally {
            saving = false;
            $('#bulkPassSaveProgress,#bulkPassSaveAndPass').prop('disabled', false);
        }
    }

    function open(options) {
        const rows = options.rows || [];
        if (!rows.length) {
            Swal.fire({ icon: 'info', title: 'No assignments available', text: 'There are no pending assignments to update.' });
            return;
        }
        const mode = options.mode || 'increment';
        const showDamage = options.showDamage !== false;
        const element = modalElement();
        $('#bulkPassTitle').text(options.title || 'Bulk Pass Assignments');
        $('#bulkPassHead').html(`<tr><th>#</th><th>Batch ID</th><th>${escapeHtml(options.itemLabel || 'Sub-Batch')}</th><th>Brand / Piece</th><th>Worker</th><th>Assigned</th><th>Completed</th>${showDamage ? '<th>Damage</th>' : ''}<th>Remaining</th><th>${mode === 'absolute' ? 'Set Completed' : 'Add Completed'}</th>${showDamage ? '<th>Add Damage</th>' : ''}</tr>`);
        $('#bulkPassRows').html(rows.map((item, index) => {
            const quantity = Number(item.quantity || 0);
            const completed = Number(item.completed || 0);
            const damage = Number(item.damage || 0);
            const remaining = Math.max(0, quantity - damage - completed);
            return `<tr data-id="${escapeHtml(item.id)}">
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(item.batchId || '-')}</strong></td>
                <td class="text-primary fw-semibold">${escapeHtml(item.label || '-')}</td>
                <td>${escapeHtml(item.brand || '-')}<div class="small text-muted">${escapeHtml(item.piece || '')}</div></td>
                <td>${escapeHtml(item.worker || '-')}</td>
                <td>${quantity}</td>
                <td>${completed}</td>
                ${showDamage ? `<td>${damage}</td>` : ''}
                <td class="bulk-pass-remaining">${remaining}</td>
                <td><input class="form-control form-control-sm bulk-pass-completed" type="number" min="${mode === 'absolute' ? completed : 0}" step="1" ${mode === 'absolute' ? `max="${quantity - damage}" value="${completed}"` : `max="${remaining}" value="0"`} aria-label="${mode === 'absolute' ? 'Set completed quantity' : 'Add completed quantity'}"></td>
                ${showDamage ? `<td><input class="form-control form-control-sm bulk-pass-damage" type="number" min="0" step="1" max="${Math.max(0, quantity - damage - completed)}" value="0" aria-label="Add damage quantity"></td>` : ''}
            </tr>`;
        }).join(''));

        $('#bulkPassRows').off('input', '.bulk-pass-completed,.bulk-pass-damage')
            .on('input', '.bulk-pass-completed,.bulk-pass-damage', function () {
                const row = $(this).closest('tr'), item = rows.find(value => String(value.id) === String(row.data('id')));
                if (!item) return;
                const completion = Number(row.find('.bulk-pass-completed').val()) || 0;
                const damage = Number(row.find('.bulk-pass-damage').val()) || 0;
                const completedTotal = mode === 'absolute' ? completion : Number(item.completed || 0) + completion;
                row.find('.bulk-pass-remaining').text(Math.max(0, Number(item.quantity) - Number(item.damage || 0) - damage - completedTotal));
            });
        $('#bulkPassSaveProgress').off('click').on('click', () => runSave(options, rows, mode, showDamage));
        $('#bulkPassSaveAndPass').off('click').on('click', () => runPass(options, rows, mode, showDamage));
        bootstrap.Modal.getOrCreateInstance(element).show();
    }

    async function runSave(options, rows, mode, showDamage) {
        if (saving) return;
        saving = true;
        $('#bulkPassSaveProgress,#bulkPassSaveAndPass').prop('disabled', true);
        try {
            const changes = changesFor(rows, mode, showDamage);
            if (!changes.length) {
                await Swal.fire({ icon: 'info', title: 'No changes to save' });
                return;
            }
            if (await options.onSave(changes)) bootstrap.Modal.getOrCreateInstance(modalElement()).hide();
        } catch (error) {
            await Swal.fire({ icon: 'error', title: 'Could not save bulk progress', text: error.message });
        } finally {
            saving = false;
            $('#bulkPassSaveProgress,#bulkPassSaveAndPass').prop('disabled', false);
        }
    }

    return { open };
})();
