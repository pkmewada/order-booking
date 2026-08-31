$(document).ready(function() {
    // ============================================================
    // DATA PERSISTENCE - Load from localStorage
    // ============================================================

    const WORKERS = ['Ahmad Khan', 'Bilal Ahmed', 'Danish Ali', 'Faisal Khan', 'Usman Malik',
                      'Ali Ahmed', 'Imran Khan', 'Saeed Ahmad', 'Zafar Iqbal', 'Rashid Mahmood'];

    const FIRMS = ['Ahmad Tailors', 'Bilal Garments', 'Danish Fabrics', 'Faisal Stitching', 'Usman Enterprises',
                   'Ali Industries', 'Imran Textiles', 'Saeed Garments', 'Zafar Fabrics', 'Rashid Tailors'];

    function loadData() {
        const savedOutsource = localStorage.getItem('stitching_outsource');
        const savedInhouse = localStorage.getItem('stitching_inhouse');
        const savedNextId = localStorage.getItem('stitching_nextId');
        const savedCounters = localStorage.getItem('stitching_subBatchCounters');

        let outsource = savedOutsource ? JSON.parse(savedOutsource) : [];
        let inhouse = savedInhouse ? JSON.parse(savedInhouse) : [];
        let nextId = savedNextId ? parseInt(savedNextId) : 1;
        let subBatchCounters = savedCounters ? JSON.parse(savedCounters) : {};

        return { outsource, inhouse, nextId, subBatchCounters };
    }

    function saveData() {
        localStorage.setItem('stitching_outsource', JSON.stringify(stitchingData.outsource));
        localStorage.setItem('stitching_inhouse', JSON.stringify(stitchingData.inhouse));
        localStorage.setItem('stitching_nextId', String(nextId));
        localStorage.setItem('stitching_subBatchCounters', JSON.stringify(subBatchCounters));
    }

    let loaded = loadData();
    let stitchingData = {
        outsource: loaded.outsource,
        inhouse: loaded.inhouse
    };
    let nextId = loaded.nextId;
    let subBatchCounters = loaded.subBatchCounters;
    let currentEditingId = null;

    // ============================================================
    // Helper Functions
    // ============================================================

    function formatDateDisplay(dateString) {
        if (!dateString) return 'Not Set';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Not Set';
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }

    function getDeliveryStatusClass(deliveryDate) {
        if (!deliveryDate) return 'delivery-badge-secondary';
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const delivery = new Date(deliveryDate); delivery.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 'delivery-overdue';
        if (diffDays === 0) return 'delivery-due-today';
        return 'delivery-ontrack';
    }

    function getPoolData() {
        return JSON.parse(localStorage.getItem('stitching_pool') || '[]');
    }

    function updatePool(poolData) {
        localStorage.setItem('stitching_pool', JSON.stringify(poolData));
    }

    function getRemainingInPool(batchId, part) {
        const pool = getPoolData();
        const item = pool.find(p => p.batchId === batchId && p.part === part);
        if (!item) return 0;
        return item.available - (item.assigned || 0);
    }

    function getPartLetter(part) {
        if (part === 'Upper') return 'U';
        if (part === 'Lower') return 'L';
        if (part === 'Jacket') return 'J';
        return 'C'; // Single
    }

    function generateStitchSubBatchId(batchId, part) {
        const key = `${batchId}_${part}`;
        const nextNum = (subBatchCounters[key] || 0) + 1;
        subBatchCounters[key] = nextNum;
        return `${batchId}-${getPartLetter(part)}-ST${nextNum}`;
    }

    // Push completed stitching to next stage (ironing)
    function pushToNextStage(batchId, part, quantity, name, type) {
        let nextStagePool = JSON.parse(localStorage.getItem('ironing_pool') || '[]');
        const existingIndex = nextStagePool.findIndex(item => item.batchId === batchId && item.part === part);

        if (existingIndex !== -1) {
            nextStagePool[existingIndex].available += quantity;
            if (!nextStagePool[existingIndex].sources) nextStagePool[existingIndex].sources = [];
            nextStagePool[existingIndex].sources.push({ name, type, quantity });
        } else {
            nextStagePool.push({
                batchId, part, available: quantity,
                sources: [{ name, type, quantity }],
                passed: 0, assigned: 0
            });
        }

        localStorage.setItem('ironing_pool', JSON.stringify(nextStagePool));
    }

    // ============================================================
    // Render Functions
    // ============================================================

    function renderOutsource() {
        const tbody = $('#outsourceList');
        tbody.empty();

        const activeItems = stitchingData.outsource.filter(item => !item.fullyPassed);

        if (activeItems.length === 0) {
            tbody.append(`<tr><td colspan="12" class="text-center text-muted py-3"><i class="bx bx-info-circle me-2"></i>No outsource firms assigned.</td></tr>`);
            $('#outsourceCount').text(0);
            return;
        }

        activeItems.forEach((item, index) => {
            const progress = item.assigned > 0 ? Math.round((item.completed / item.assigned) * 100) : 0;
            const remaining = item.assigned - item.completed;
            const passedQty = item.passedQty || 0;
            const pendingToPass = item.completed - passedQty;

            let statusText = 'Pending', statusClass = 'bg-secondary';
            if (passedQty > 0 && passedQty < item.assigned) { statusText = `Partially Passed (${passedQty}/${item.assigned})`; statusClass = 'bg-info'; }
            else if (item.completed === item.assigned && item.completed > 0) { statusText = 'Complete ✓'; statusClass = 'bg-success'; }
            else if (item.completed > 0) { statusText = 'In Progress'; statusClass = 'bg-warning'; }

            let deliveryDisplay = '<span class="text-muted">Not Set</span>';
            if (item.deliveryDate) {
                deliveryDisplay = `<span class="badge ${getDeliveryStatusClass(item.deliveryDate)} delivery-date-badge">${formatDateDisplay(item.deliveryDate)}</span>`;
            }

            tbody.append(`
                <tr>
                    <td>${index + 1}</td>
                    <td><span class="fw-bold">${item.batchId}</span></td>
                    <td><span class="sub-batch-label text-primary fw-semibold">${item.subBatch}</span></td>
                    <td><span class="badge bg-info">${item.part || 'Single'}</span></td>
                    <td><strong>${item.firm}</strong></td>
                    <td>${item.assigned}</td>
                    <td>${item.completed}</td>
                    <td><span class="${remaining > 0 ? 'text-danger fw-bold' : 'text-success'}">${remaining}</span></td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <span>${progress}%</span>
                            <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${progress}%;"></div></div>
                        </div>
                    </td>
                    <td>${deliveryDisplay}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary update-progress-btn" data-id="${item.id}" data-type="outsource" title="Update Progress"><i class="bx bx-edit"></i></button>
                        ${pendingToPass > 0 ? `<button class="btn btn-sm btn-pass pass-to-next-btn" data-id="${item.id}" data-type="outsource" title="Pass ${pendingToPass} pcs to Ironing"><i class="bx bx-right-arrow-alt"></i> Pass ${pendingToPass}</button>` : ''}
                        <button class="btn btn-sm btn-danger delete-btn" data-id="${item.id}" data-type="outsource" title="Delete"><i class="bx bx-trash"></i></button>
                    </td>
                </tr>
            `);
        });

        $('#outsourceCount').text(activeItems.length);
    }

    function renderInhouse() {
        const tbody = $('#inhouseList');
        tbody.empty();

        const activeItems = stitchingData.inhouse.filter(item => !item.fullyPassed);

        if (activeItems.length === 0) {
            tbody.append(`<tr><td colspan="13" class="text-center text-muted py-3"><i class="bx bx-info-circle me-2"></i>No in-house workers assigned.</td></tr>`);
            $('#inhouseCount').text(0);
            return;
        }

        activeItems.forEach((item, index) => {
            const progress = item.assigned > 0 ? Math.round((item.completed / item.assigned) * 100) : 0;
            const remaining = item.assigned - item.completed;
            const passedQty = item.passedQty || 0;
            const pendingToPass = item.completed - passedQty;

            let statusText = 'Pending', statusClass = 'bg-secondary';
            if (passedQty > 0 && passedQty < item.assigned) { statusText = `Partially Passed (${passedQty}/${item.assigned})`; statusClass = 'bg-info'; }
            else if (item.completed === item.assigned && item.completed > 0) { statusText = 'Complete ✓'; statusClass = 'bg-success'; }
            else if (item.completed > 0) { statusText = 'In Progress'; statusClass = 'bg-warning'; }

            let deliveryDisplay = '<span class="text-muted">Not Set</span>';
            if (item.deliveryDate) {
                deliveryDisplay = `<span class="badge ${getDeliveryStatusClass(item.deliveryDate)} delivery-date-badge">${formatDateDisplay(item.deliveryDate)}</span>`;
            }

            tbody.append(`
                <tr>
                    <td>${index + 1}</td>
                    <td><span class="fw-bold">${item.batchId}</span></td>
                    <td><span class="sub-batch-label text-primary fw-semibold">${item.subBatch}</span></td>
                    <td><span class="badge bg-info">${item.part || 'Single'}</span></td>
                    <td><strong>${item.worker}</strong></td>
                    <td><span class="badge bg-info">${item.size}</span></td>
                    <td>${item.assigned}</td>
                    <td>${item.completed}</td>
                    <td><span class="${remaining > 0 ? 'text-danger fw-bold' : 'text-success'}">${remaining}</span></td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <span>${progress}%</span>
                            <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${progress}%;"></div></div>
                        </div>
                    </td>
                    <td>${deliveryDisplay}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary update-progress-btn" data-id="${item.id}" data-type="inhouse" title="Update Progress"><i class="bx bx-edit"></i></button>
                        ${pendingToPass > 0 ? `<button class="btn btn-sm btn-pass pass-to-next-btn" data-id="${item.id}" data-type="inhouse" title="Pass ${pendingToPass} pcs to Ironing"><i class="bx bx-right-arrow-alt"></i> Pass ${pendingToPass}</button>` : ''}
                        <button class="btn btn-sm btn-danger delete-btn" data-id="${item.id}" data-type="inhouse" title="Delete"><i class="bx bx-trash"></i></button>
                    </td>
                </tr>
            `);
        });

        $('#inhouseCount').text(activeItems.length);
    }

    function renderAll() {
        renderOutsource();
        renderInhouse();
    }

    // ============================================================
    // Populate Batch / Part Selects (Step 1 of assign modal)
    // ============================================================

    function populateBatchSelect() {
        const pool = getPoolData();
        const batchIds = [...new Set(pool.map(item => item.batchId))].filter(batchId => {
            // only show batches that still have remaining pieces in ANY part
            const parts = pool.filter(p => p.batchId === batchId);
            return parts.some(p => (p.available - (p.assigned || 0)) > 0);
        });

        const select = $('#batchSelect');
        select.empty();
        select.append('<option value="">Choose Batch</option>');
        batchIds.forEach(batchId => {
            select.append(`<option value="${batchId}">${batchId}</option>`);
        });
    }

    function populatePartSelect() {
        const batchId = $('#batchSelect').val();
        const select = $('#partSelect');
        select.empty();
        select.append('<option value="">Choose Part</option>');
        $('#rowsContainer').empty();

        if (!batchId) return;

        const pool = getPoolData();
        const parts = pool.filter(p => p.batchId === batchId);

        parts.forEach(p => {
            const remaining = p.available - (p.assigned || 0);
            if (remaining > 0) {
                select.append(`<option value="${p.part}" data-remaining="${remaining}">${p.part} - ${remaining} available</option>`);
            }
        });
    }

    // ============================================================
    // Generate Split Rows (Step 2 of assign modal) - mirrors Cutting Manager
    // ============================================================

    function generateRows(batchId, part, remaining) {
        const container = $('#rowsContainer');
        container.empty();

        const splitControl = $(`
            <div class="alert alert-primary mb-3">
                <div class="row align-items-center">
                    <div class="col-md-5">
                        <i class="bx bx-layer me-2"></i>
                        <strong>${part}</strong> - ${remaining} pieces available
                    </div>
                    <div class="col-md-7">
                        <label class="form-label mb-0">Number of Rows (Workers / Firms)</label>
                        <div class="input-group">
                            <input type="number" class="form-control" id="splitCount" value="1" min="1" max="20">
                            <button class="btn btn-success" id="applySplitBtn" type="button">
                                <i class="bx bx-check"></i> Apply Split
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        container.append(splitControl);

        function generateSplitRows(count) {
            container.find('.table-responsive').remove();
            container.find('.alert-info').remove();
            container.find('.alert-success').remove();

            if (count < 1) count = 1;

            if (count > remaining) {
                Swal.fire({ icon: 'warning', title: 'Too Many Rows', text: `Cannot create ${count} rows for only ${remaining} remaining pieces.`, confirmButtonColor: '#3085d6' });
                return;
            }

            const baseQty = Math.floor(remaining / count);
            const extra = remaining % count;

            container.append(`
                <div class="alert alert-info mb-2">
                    <i class="bx bx-info-circle me-2"></i>
                    Splitting ${remaining} pieces into ${count} row(s)
                    <span class="badge bg-success ms-2">${baseQty} each${extra > 0 ? ` (${extra} extra)` : ''}</span>
                </div>
            `);

            const tableHtml = `
                <div class="table-responsive">
                    <table class="table table-bordered table-sm mb-0">
                        <thead>
                            <tr>
                                <th style="width: 13%;">Sub-Batch ID</th>
                                <th style="width: 12%;">Type</th>
                                <th style="width: 20%;">Firm / Worker</th>
                                <th style="width: 10%;">Size</th>
                                <th style="width: 10%;">Quantity</th>
                                <th style="width: 20%;">Delivery Date</th>
                            </tr>
                        </thead>
                        <tbody id="assignmentTableBody"></tbody>
                    </table>
                </div>
            `;
            container.append(tableHtml);

            const tbody = $('#assignmentTableBody');
            const defaultDeliveryDate = new Date();
            defaultDeliveryDate.setDate(defaultDeliveryDate.getDate() + 10);
            const defaultDateStr = defaultDeliveryDate.toISOString().split('T')[0];

            let workerOptions = '<option value="">Select Worker</option>' + WORKERS.map(w => `<option value="${w}">${w}</option>`).join('');
            let firmOptions = '<option value="">Select Firm</option>' + FIRMS.map(f => `<option value="${f}">${f}</option>`).join('');

            for (let i = 0; i < count; i++) {
                let qty = baseQty;
                if (i < extra) qty += 1;
                const subBatchId = generateStitchSubBatchId(batchId, part);

                const row = $(`
                    <tr class="assignment-row">
                        <td><span class="sub-batch-label">${subBatchId}</span><input type="hidden" class="sub-batch-input" value="${subBatchId}"></td>
                        <td>
                            <select class="form-select form-select-sm type-select">
                                <option value="outsource">Outsource</option>
                                <option value="inhouse" selected>In-House</option>
                            </select>
                        </td>
                        <td class="name-cell">
                            <select class="form-select form-select-sm worker-select">${workerOptions}</select>
                            <select class="form-select form-select-sm firm-select" style="display:none;">${firmOptions}</select>
                        </td>
                        <td>
                            <select class="form-select form-select-sm size-select">
                                <option value="S">S</option><option value="M" selected>M</option>
                                <option value="L">L</option><option value="XL">XL</option><option value="XXL">XXL</option>
                            </select>
                        </td>
                        <td><input type="number" class="form-control form-control-sm quantity-input" value="${qty}" min="1" max="${remaining}"></td>
                        <td><input type="date" class="form-control form-control-sm delivery-date-input" value="${defaultDateStr}"></td>
                    </tr>
                `);
                tbody.append(row);
            }

            // Toggle firm/worker+size per row based on type
            $('.type-select').off('change').on('change', function() {
                const row = $(this).closest('tr');
                const isOutsource = $(this).val() === 'outsource';
                row.find('.firm-select').toggle(isOutsource);
                row.find('.worker-select').toggle(!isOutsource);
                row.find('.size-select').closest('td').toggle(!isOutsource);
                updateSummary();
            });

            updateSummary();
            $('.quantity-input, .worker-select, .firm-select, .size-select, .delivery-date-input').on('change input', function() { updateSummary(); });
        }

        function updateSummary() {
            let total = 0, assigned = 0, hasDeliveryDates = true;
            $('.assignment-row').each(function() {
                const qty = parseInt($(this).find('.quantity-input').val()) || 0;
                total += qty;
                const type = $(this).find('.type-select').val();
                const name = type === 'outsource' ? $(this).find('.firm-select').val() : $(this).find('.worker-select').val();
                if (name) assigned++;
                if (!$(this).find('.delivery-date-input').val()) hasDeliveryDates = false;
            });

            let summary = container.find('.alert-success');
            if (summary.length === 0) {
                summary = $(`<div class="alert alert-success mt-2"></div>`);
                container.append(summary);
            }
            let summaryHtml = `<i class="bx bx-check-circle me-2"></i> <strong>${$('.assignment-row').length}</strong> rows | <strong>${assigned}</strong> assigned | <strong>${total}</strong> pieces to assign`;
            if (total === remaining) summaryHtml += ` | ✅ All ${remaining} pieces assigned`;
            else if (total < remaining) summaryHtml += ` | ℹ️ ${remaining - total} pieces remaining for later`;
            else summaryHtml += ` | ❌ Exceeds by ${total - remaining}`;
            if (!hasDeliveryDates) summaryHtml += ` | ⚠️ Missing delivery dates`;
            summary.html(summaryHtml);
        }

        generateSplitRows(1);

        $('#applySplitBtn').off('click').on('click', function() {
            const count = parseInt($('#splitCount').val()) || 1;
            generateSplitRows(count);
        });

        $('#splitCount').off('keypress').on('keypress', function(e) {
            if (e.which === 13) { e.preventDefault(); $('#applySplitBtn').click(); }
        });
    }

    // ============================================================
    // Event Handlers
    // ============================================================

    $('#addStitchingBtn').click(function() {
        const pool = getPoolData();
        const anyAvailable = pool.some(p => (p.available - (p.assigned || 0)) > 0);
        if (!anyAvailable) {
            Swal.fire({ icon: 'warning', title: 'No Available Work', text: 'No pieces have been passed from cutting to stitching yet.', confirmButtonColor: '#3085d6' });
            return;
        }
        $('#stitchingModal').modal('show');
        $('#rowsContainer').empty();
        $('#partSelect').empty().append('<option value="">Choose Part</option>');
        populateBatchSelect();
    });

    $('#batchSelect').change(function() {
        populatePartSelect();
    });

    $('#partSelect').change(function() {
        const batchId = $('#batchSelect').val();
        const selected = $(this).find(':selected');
        const part = selected.val();
        if (!batchId || !part) { $('#rowsContainer').empty(); return; }
        const remaining = parseInt(selected.data('remaining')) || 0;
        generateRows(batchId, part, remaining);
    });

    // Save Assignment
    $('#saveAssignBtn').click(function() {
        const batchId = $('#batchSelect').val();
        const part = $('#partSelect').val();

        if (!batchId || !part) {
            Swal.fire({ icon: 'warning', title: 'Select Batch & Part', text: 'Please select a batch and part first.', confirmButtonColor: '#3085d6' });
            return;
        }

        const remaining = getRemainingInPool(batchId, part);
        if (remaining === 0) {
            Swal.fire({ icon: 'warning', title: 'Nothing Available', text: 'All pieces for this batch/part have already been assigned!', confirmButtonColor: '#3085d6' });
            return;
        }

        const rows = [];
        let isValid = true, errorMsg = '', totalAssigned = 0;

        $('.assignment-row').each(function() {
            const subBatch = $(this).find('.sub-batch-input').val();
            const type = $(this).find('.type-select').val();
            const worker = $(this).find('.worker-select').val();
            const firm = $(this).find('.firm-select').val();
            const size = $(this).find('.size-select').val() || 'M';
            const quantity = parseInt($(this).find('.quantity-input').val()) || 0;
            const deliveryDate = $(this).find('.delivery-date-input').val();

            if (type === 'outsource' && !firm) { isValid = false; errorMsg = `Please select a firm for ${subBatch}`; return false; }
            if (type === 'inhouse' && !worker) { isValid = false; errorMsg = `Please select a worker for ${subBatch}`; return false; }
            if (quantity < 1) { isValid = false; errorMsg = `Please enter valid quantity for ${subBatch}`; return false; }
            if (!deliveryDate) { isValid = false; errorMsg = `Please select a delivery date for ${subBatch}`; return false; }

            totalAssigned += quantity;
            rows.push({ subBatch, type, worker, firm, size, quantity, deliveryDate });
        });

        if (!isValid) {
            Swal.fire({ icon: 'warning', title: 'Incomplete Form', text: errorMsg, confirmButtonColor: '#3085d6' });
            return;
        }

        if (totalAssigned > remaining) {
            Swal.fire({ icon: 'warning', title: 'Quantity Exceeds Remaining', text: `Total assigned (${totalAssigned}) exceeds remaining (${remaining}).`, confirmButtonColor: '#3085d6' });
            return;
        }

        const leftoverAfter = remaining - totalAssigned;
        let message = `<p><strong>Batch:</strong> ${batchId} | <strong>Part:</strong> ${part}</p>`;
        message += `<p><strong>Now Assigning (${rows.length} rows):</strong></p><ul>`;
        rows.forEach(row => {
            const name = row.type === 'outsource' ? row.firm : row.worker;
            const formattedDate = formatDateDisplay(row.deliveryDate);
            message += `<li><strong>${row.subBatch}:</strong> ${name} (${row.type === 'outsource' ? 'Outsource' : 'In-House' + (row.size ? ', Size ' + row.size : '')}) - ${row.quantity} pcs - Delivery: ${formattedDate}</li>`;
        });
        message += `</ul>`;
        if (leftoverAfter === 0) message += `<p class="text-success"><strong>After assignment: 0 pieces remaining ✅</strong></p>`;
        else message += `<p class="text-primary"><strong>After assignment: ${leftoverAfter} pieces will remain available.</strong></p>`;

        Swal.fire({
            title: 'Confirm Assignment',
            html: message,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                rows.forEach(row => {
                    const record = {
                        id: nextId++,
                        batchId, part,
                        subBatch: row.subBatch,
                        assigned: row.quantity,
                        completed: 0,
                        passedQty: 0,
                        fullyPassed: false,
                        deliveryDate: row.deliveryDate,
                        status: 'pending'
                    };
                    if (row.type === 'outsource') {
                        record.firm = row.firm;
                        stitchingData.outsource.push(record);
                    } else {
                        record.worker = row.worker;
                        record.size = row.size;
                        stitchingData.inhouse.push(record);
                    }
                });

                // Update pool
                const pool = getPoolData();
                const poolItem = pool.find(p => p.batchId === batchId && p.part === part);
                if (poolItem) {
                    poolItem.assigned = (poolItem.assigned || 0) + totalAssigned;
                    updatePool(pool);
                }

                saveData();
                renderAll();
                $('#stitchingModal').modal('hide');

                Swal.fire({
                    icon: 'success',
                    title: 'Assigned Successfully!',
                    text: `${rows.length} row(s) assigned! ${totalAssigned} pieces assigned${leftoverAfter > 0 ? `, ${leftoverAfter} pieces still available.` : '.'}`,
                    timer: 3000,
                    showConfirmButton: false
                });
            }
        });
    });

    // Update Progress button
    $(document).on('click', '.update-progress-btn', function() {
        const id = parseInt($(this).data('id'));
        const type = $(this).data('type');
        let item = type === 'outsource' ? stitchingData.outsource.find(i => i.id === id) : stitchingData.inhouse.find(i => i.id === id);
        if (!item) return;

        $('#progressId').val(id);
        $('#progressType').val(type);
        $('#progressName').val(`${item.subBatch} — ${type === 'outsource' ? item.firm : item.worker}`);
        $('#progressCurrentDisplay').text(item.completed);
        $('#progressTotalDisplay').text(item.assigned);
        $('#progressAddQty').val(5);
        $('#progressExactQty').val('');

        const passedQty = item.passedQty || 0;
        const availableToPass = item.completed - passedQty;
        if (availableToPass > 0) {
            $('#passSection').show();
            $('#maxPassQty').text(availableToPass);
            $('#passQty').val(availableToPass);
        } else {
            $('#passSection').hide();
        }

        $('#progressModal').modal('show');
    });

    function updateItemProgress(itemId, type, newCompleted) {
        let dataArray = type === 'outsource' ? stitchingData.outsource : stitchingData.inhouse;
        const item = dataArray.find(i => i.id === itemId);
        if (!item) return false;

        item.completed = Math.min(newCompleted, item.assigned);
        if (item.completed >= item.assigned && (item.passedQty || 0) >= item.assigned) {
            item.status = 'complete';
        } else if (item.completed > 0) {
            item.status = 'inprogress';
        } else {
            item.status = 'pending';
        }

        saveData();
        renderAll();
        return true;
    }

    $('#addProgressBtn').click(function() {
        const id = parseInt($('#progressId').val());
        const type = $('#progressType').val();
        const addQty = parseInt($('#progressAddQty').val()) || 0;

        if (addQty <= 0) {
            Swal.fire({ icon: 'warning', title: 'Invalid Quantity', text: 'Please enter a valid quantity.', confirmButtonColor: '#3085d6' });
            return;
        }

        let dataArray = type === 'outsource' ? stitchingData.outsource : stitchingData.inhouse;
        const item = dataArray.find(i => i.id === id);
        if (!item) return;

        const newCompleted = Math.min(item.completed + addQty, item.assigned);
        updateItemProgress(id, type, newCompleted);

        const passedQty = item.passedQty || 0;
        const availableToPass = item.completed - passedQty;
        if (availableToPass > 0) {
            $('#passSection').show();
            $('#maxPassQty').text(availableToPass);
            $('#passQty').val(availableToPass);
        } else {
            $('#passSection').hide();
        }
        $('#progressCurrentDisplay').text(item.completed);

        Swal.fire({ icon: 'success', title: 'Progress Updated!', text: `${newCompleted}/${item.assigned} pieces completed.`, timer: 2000, showConfirmButton: false });
    });

    $('#setProgressBtn').click(function() {
        const id = parseInt($('#progressId').val());
        const type = $('#progressType').val();
        const exactQty = parseInt($('#progressExactQty').val());

        if (isNaN(exactQty) || exactQty < 0) {
            Swal.fire({ icon: 'warning', title: 'Invalid Quantity', text: 'Please enter a valid quantity.', confirmButtonColor: '#3085d6' });
            return;
        }

        let dataArray = type === 'outsource' ? stitchingData.outsource : stitchingData.inhouse;
        const item = dataArray.find(i => i.id === id);
        if (!item) return;

        if (exactQty > item.assigned) {
            Swal.fire({ icon: 'warning', title: 'Exceeds Limit', text: `Cannot exceed assigned quantity (${item.assigned})`, confirmButtonColor: '#3085d6' });
            return;
        }
        const passedQty = item.passedQty || 0;
        if (exactQty < passedQty) {
            Swal.fire({ icon: 'warning', title: 'Below Already-Passed Amount', text: `${passedQty} pieces already passed, progress can't go below that.`, confirmButtonColor: '#3085d6' });
            return;
        }

        updateItemProgress(id, type, exactQty);

        const availableToPass = item.completed - passedQty;
        if (availableToPass > 0) {
            $('#passSection').show();
            $('#maxPassQty').text(availableToPass);
            $('#passQty').val(availableToPass);
        } else {
            $('#passSection').hide();
        }
        $('#progressCurrentDisplay').text(item.completed);

        Swal.fire({ icon: 'success', title: 'Progress Set!', text: `${exactQty}/${item.assigned} pieces completed.`, timer: 2000, showConfirmButton: false });
    });

    // Pass to Next Stage (from progress modal)
    $('#passToNextBtn').click(function() {
        const id = parseInt($('#progressId').val());
        const type = $('#progressType').val();
        const passQty = parseInt($('#passQty').val()) || 0;
        doPass(id, type, passQty, true);
    });

    // Pass directly from table button
    $(document).on('click', '.pass-to-next-btn', function() {
        const id = parseInt($(this).data('id'));
        const type = $(this).data('type');
        let dataArray = type === 'outsource' ? stitchingData.outsource : stitchingData.inhouse;
        const item = dataArray.find(i => i.id === id);
        if (!item) return;
        const passedQty = item.passedQty || 0;
        const pendingToPass = item.completed - passedQty;
        if (pendingToPass <= 0) return;
        doPass(id, type, pendingToPass, false);
    });

    function doPass(id, type, passQty, fromModal) {
        let dataArray = type === 'outsource' ? stitchingData.outsource : stitchingData.inhouse;
        const item = dataArray.find(i => i.id === id);
        if (!item) return;

        const passedQty = item.passedQty || 0;
        const availableToPass = item.completed - passedQty;

        if (passQty <= 0 || passQty > availableToPass) {
            Swal.fire({ icon: 'warning', title: 'Invalid Quantity', text: `Only ${availableToPass} pieces available to pass.`, confirmButtonColor: '#3085d6' });
            return;
        }

        const stillOpen = item.assigned - (passedQty + passQty);
        const name = type === 'outsource' ? item.firm : item.worker;

        Swal.fire({
            title: 'Pass to Ironing?',
            html: `
                <div class="text-start">
                    <p><strong>Sub-Batch:</strong> ${item.subBatch}</p>
                    <p><strong>Part:</strong> ${item.part}</p>
                    <p><strong>${type === 'outsource' ? 'Firm' : 'Worker'}:</strong> ${name}</p>
                    <p><strong>Total Assigned:</strong> ${item.assigned} pieces</p>
                    <p><strong>Already Passed:</strong> ${passedQty} pieces</p>
                    <p class="text-success"><strong>Passing Now:</strong> ${passQty} pieces</p>
                    ${stillOpen > 0 ? `<hr><p class="text-warning"><strong>Still to complete:</strong> ${stillOpen} pieces</p><p class="text-muted">This row stays open — come back and pass the rest later.</p>` : `<hr><p class="text-success">All ${item.assigned} pieces will be passed! ✅</p>`}
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: `Yes, pass ${passQty}`,
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                pushToNextStage(item.batchId, item.part, passQty, name, type);

                item.passedQty = passedQty + passQty;
                if (item.passedQty >= item.assigned) {
                    item.fullyPassed = true;
                    item.status = 'complete';
                }

                saveData();
                renderAll();
                if (fromModal) $('#progressModal').modal('hide');

                Swal.fire({
                    icon: 'success',
                    title: item.fullyPassed ? 'Fully Passed to Ironing!' : 'Partially Passed!',
                    text: item.fullyPassed ? `${item.subBatch} is complete — all ${item.assigned} pieces passed.` : `${passQty} pieces sent to ironing. ${item.assigned - item.passedQty} pieces still open.`,
                    timer: 3000,
                    showConfirmButton: false
                });
            }
        });
    }

    // Delete button
    $(document).on('click', '.delete-btn', function() {
        const id = parseInt($(this).data('id'));
        const type = $(this).data('type');
        let dataArray = type === 'outsource' ? stitchingData.outsource : stitchingData.inhouse;
        const item = dataArray.find(i => i.id === id);
        if (!item) return;

        const name = type === 'outsource' ? item.firm : item.worker;

        Swal.fire({
            title: 'Are you sure?',
            html: `<div class="text-start"><p><strong>Sub-Batch:</strong> ${item.subBatch}</p><p><strong>${type === 'outsource' ? 'Firm' : 'Worker'}:</strong> ${name}</p><p><strong>Batch:</strong> ${item.batchId}</p><p><strong>Quantity:</strong> ${item.assigned} pieces</p></div>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                // Return un-completed, un-passed quantity back to pool
                const passedQty = item.passedQty || 0;
                const toReturn = item.assigned - passedQty;
                if (toReturn > 0) {
                    const pool = getPoolData();
                    const poolItem = pool.find(p => p.batchId === item.batchId && p.part === item.part);
                    if (poolItem) {
                        poolItem.assigned = Math.max(0, (poolItem.assigned || 0) - toReturn);
                        updatePool(pool);
                    }
                }

                if (type === 'outsource') {
                    stitchingData.outsource = stitchingData.outsource.filter(i => i.id !== id);
                } else {
                    stitchingData.inhouse = stitchingData.inhouse.filter(i => i.id !== id);
                }
                saveData();
                renderAll();
                Swal.fire({ icon: 'success', title: 'Deleted!', text: 'Assignment has been deleted.', timer: 2000, showConfirmButton: false });
            }
        });
    });

    // Modal close handlers
    $('#stitchingModal').on('hidden.bs.modal', function() {
        $('#rowsContainer').empty();
        $('#batchSelect').val('');
        $('#partSelect').empty().append('<option value="">Choose Part</option>');
    });

    $('#progressModal').on('hidden.bs.modal', function() {
        currentEditingId = null;
        $('#passSection').hide();
    });

    // ============================================================
    // Initial Render
    // ============================================================

    renderAll();
});