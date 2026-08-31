$(document).ready(function() {
    // ============================================================
    // DATA PERSISTENCE - Load from localStorage
    // ============================================================

    const WORKERS = ['Ahmad Khan', 'Bilal Ahmed', 'Danish Ali', 'Faisal Khan', 'Usman Malik',
                      'Ali Ahmed', 'Imran Khan', 'Saeed Ahmad', 'Zafar Iqbal', 'Rashid Mahmood'];

    function loadData() {
        const savedIroning = localStorage.getItem('ironing_data');
        const savedNextId = localStorage.getItem('ironing_nextId');
        const savedCounters = localStorage.getItem('ironing_subBatchCounters');

        let ironingData = savedIroning ? JSON.parse(savedIroning) : [];
        let nextId = savedNextId ? parseInt(savedNextId) : 1;
        let subBatchCounters = savedCounters ? JSON.parse(savedCounters) : {};

        return { ironingData, nextId, subBatchCounters };
    }

    function saveData() {
        localStorage.setItem('ironing_data', JSON.stringify(ironingData));
        localStorage.setItem('ironing_nextId', String(nextId));
        localStorage.setItem('ironing_subBatchCounters', JSON.stringify(subBatchCounters));
    }

    let loaded = loadData();
    let ironingData = loaded.ironingData;
    let nextId = loaded.nextId;
    let subBatchCounters = loaded.subBatchCounters;

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
        return JSON.parse(localStorage.getItem('ironing_pool') || '[]');
    }

    function updatePool(poolData) {
        localStorage.setItem('ironing_pool', JSON.stringify(poolData));
    }

    function getRemainingInPool(batchId, part) {
        const pool = getPoolData();
        const item = pool.find(p => p.batchId === batchId && p.part === part);
        if (!item) return 0;
        return item.available - (item.assigned || 0);
    }

    function getBatchData() {
        return JSON.parse(localStorage.getItem('cutting_batchData') || '[]');
    }

    function getPieceType(batchId) {
        const batchData = getBatchData();
        const batch = batchData.find(b => b.batchId === batchId);
        return batch ? batch.pieceType : '1 Piece';
    }

    function getPartsForPieceType(pieceType) {
        if (pieceType === '2 Piece') return ['Upper', 'Lower'];
        if (pieceType === '3 Piece') return ['Upper', 'Jacket', 'Lower'];
        return ['Single'];
    }

    function getPartLetter(part) {
        if (part === 'Upper') return 'U';
        if (part === 'Lower') return 'L';
        if (part === 'Jacket') return 'J';
        return 'C';
    }

    // Generate sub-batch IDs for all parts of a worker
    function generateIronSubBatchIds(batchId, pieceType, workerIndex) {
        const parts = getPartsForPieceType(pieceType);
        const ids = {};
        parts.forEach(part => {
            const key = `${batchId}_${part}`;
            const nextNum = (subBatchCounters[key] || 0) + 1;
            subBatchCounters[key] = nextNum;
            ids[part] = `${batchId}-${getPartLetter(part)}-I${nextNum}`;
        });
        return ids;
    }

    // Push completed ironing to next stage (packing)
    function pushToNextStage(batchId, part, quantity, worker) {
        let nextStagePool = JSON.parse(localStorage.getItem('packing_pool') || '[]');
        const existingIndex = nextStagePool.findIndex(item => item.batchId === batchId && item.part === part);

        if (existingIndex !== -1) {
            nextStagePool[existingIndex].available += quantity;
            if (!nextStagePool[existingIndex].sources) nextStagePool[existingIndex].sources = [];
            nextStagePool[existingIndex].sources.push({ worker, quantity });
        } else {
            nextStagePool.push({
                batchId, part, available: quantity,
                sources: [{ worker, quantity }],
                passed: 0, assigned: 0
            });
        }

        localStorage.setItem('packing_pool', JSON.stringify(nextStagePool));
    }

    // ============================================================
    // Render Table
    // ============================================================
    function renderTable() {
        const tbody = $('#teamsList');
        tbody.empty();

        const activeItems = ironingData.filter(item => !item.fullyPassed);

        if (activeItems.length === 0) {
            tbody.append(`<tr><td colspan="11" class="text-center text-muted py-4"><i class="bx bx-info-circle me-2"></i>No ironing assignments yet.</td></tr>`);
            $('#teamCount').text(0);
            renderNotifications();
            return;
        }

        // Group by worker and batch
        const grouped = {};
        activeItems.forEach(item => {
            const key = `${item.batchId}_${item.worker}`;
            if (!grouped[key]) {
                grouped[key] = {
                    batchId: item.batchId,
                    worker: item.worker,
                    parts: [],
                    totalQuantity: 0,
                    totalProgress: 0,
                    totalPassedQty: 0,
                    deliveryDate: item.deliveryDate,
                    fullyPassed: false
                };
            }
            grouped[key].parts.push({
                part: item.part,
                subBatch: item.subBatch,
                quantity: item.quantity,
                progress: item.progress || 0,
                passedQty: item.passedQty || 0,
                id: item.id
            });
            grouped[key].totalQuantity += item.quantity;
            grouped[key].totalProgress += (item.progress || 0);
            grouped[key].totalPassedQty += (item.passedQty || 0);
            if (!grouped[key].deliveryDate && item.deliveryDate) {
                grouped[key].deliveryDate = item.deliveryDate;
            }
        });

        let index = 0;
        Object.keys(grouped).forEach(key => {
            const group = grouped[key];
            index++;
            const progressPercent = group.totalQuantity > 0 ? Math.round((group.totalProgress / group.totalQuantity) * 100) : 0;
            const remaining = group.totalQuantity - group.totalProgress;
            const pendingToPass = group.totalProgress - group.totalPassedQty;

            let statusText = 'Pending', statusClass = 'bg-secondary';
            if (group.totalPassedQty > 0 && group.totalPassedQty < group.totalQuantity) { 
                statusText = `Partially Passed (${group.totalPassedQty}/${group.totalQuantity})`; 
                statusClass = 'bg-info'; 
            } else if (group.totalProgress === group.totalQuantity && group.totalProgress > 0) { 
                statusText = 'Complete ✓'; 
                statusClass = 'bg-success'; 
            } else if (group.totalProgress > 0) { 
                statusText = 'In Progress'; 
                statusClass = 'bg-warning'; 
            }

            let deliveryDisplay = '<span class="text-muted">Not Set</span>';
            if (group.deliveryDate) {
                deliveryDisplay = `<span class="badge ${getDeliveryStatusClass(group.deliveryDate)} delivery-date-badge">${formatDateDisplay(group.deliveryDate)}</span>`;
            }

            // Show parts breakdown
            const partsDisplay = group.parts.map(p => 
                `<span class="badge bg-info me-1">${p.part}: ${p.subBatch}</span>`
            ).join(' ');

            tbody.append(`
                <tr>
                    <td>${index}</td>
                    <td><span class="fw-bold">${group.batchId}</span></td>
                    <td>${partsDisplay}</td>
                    <td><span class="badge bg-secondary">${group.parts.length} part(s)</span></td>
                    <td><strong>${group.worker}</strong></td>
                    <td>${group.totalQuantity}</td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <span>${group.totalProgress}</span>
                            <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${progressPercent}%;"></div></div>
                        </div>
                    </td>
                    <td>${remaining}</td>
                    <td>${deliveryDisplay}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary update-progress-btn" data-worker="${group.worker}" data-batch="${group.batchId}" title="Update Progress"><i class="bx bx-edit"></i></button>
                        ${pendingToPass > 0 ? `<button class="btn btn-sm btn-pass pass-to-next-btn" data-worker="${group.worker}" data-batch="${group.batchId}" title="Pass ${pendingToPass} pcs to Packing"><i class="bx bx-right-arrow-alt"></i> Pass ${pendingToPass}</button>` : ''}
                        <button class="btn btn-sm btn-danger delete-btn" data-worker="${group.worker}" data-batch="${group.batchId}" title="Delete"><i class="bx bx-trash"></i></button>
                    </td>
                </tr>
            `);
        });

        $('#teamCount').text(Object.keys(grouped).length);
        renderNotifications();
    }

    function renderNotifications() {
        const container = $('#notificationList');
        container.empty();

        const activeItems = ironingData.filter(item => !item.fullyPassed);
        
        // Group by worker
        const grouped = {};
        activeItems.forEach(item => {
            const key = `${item.batchId}_${item.worker}`;
            if (!grouped[key]) {
                grouped[key] = {
                    worker: item.worker,
                    batchId: item.batchId,
                    total: 0,
                    progress: 0,
                    parts: []
                };
            }
            grouped[key].total += item.quantity;
            grouped[key].progress += (item.progress || 0);
            grouped[key].parts.push(item.part);
        });

        Object.keys(grouped).forEach(key => {
            const g = grouped[key];
            const percent = g.total > 0 ? Math.round((g.progress / g.total) * 100) : 0;
            const isComplete = g.progress >= g.total && g.total > 0;
            const partsStr = g.parts.join(' + ');
            
            if (isComplete) {
                container.append(`
                    <div class="alert alert-success mb-0 d-flex align-items-center">
                        <i class="bx bx-check-circle me-2"></i>
                        <span><strong>${g.worker}</strong> — ${g.batchId} (${partsStr}) complete! (${g.progress}/${g.total})</span>
                    </div>
                `);
            } else if (g.progress > 0) {
                container.append(`
                    <div class="alert alert-info mb-0 d-flex align-items-center">
                        <i class="bx bx-loader-circle me-2"></i>
                        <span><strong>${g.worker}</strong> — ${g.batchId} (${partsStr}) ${percent}% (${g.progress}/${g.total})</span>
                    </div>
                `);
            }
        });

        if (Object.keys(grouped).length === 0) {
            container.append(`<div class="alert alert-secondary mb-0"><i class="bx bx-info-circle me-2"></i>No ironing work in progress yet.</div>`);
        }
    }

    // ============================================================
    // Populate Batch Select - Shows only batches with ALL required parts available
    // ============================================================

    function populateBatchSelect() {
        const pool = getPoolData();
        const batchData = getBatchData();
        const select = $('#batchSelect');
        select.empty();
        select.append('<option value="">Choose Batch</option>');

        // Get unique batchIds from pool
        const batchIds = [...new Set(pool.map(item => item.batchId))];

        batchIds.forEach(batchId => {
            const pieceType = getPieceType(batchId);
            const requiredParts = getPartsForPieceType(pieceType);
            
            // Check if ALL required parts are available in the pool
            const allPartsAvailable = requiredParts.every(part => {
                const remaining = getRemainingInPool(batchId, part);
                return remaining > 0;
            });

            if (allPartsAvailable) {
                // Find the minimum available quantity across all required parts
                const minAvailable = Math.min(...requiredParts.map(part => getRemainingInPool(batchId, part)));
                const partDetails = requiredParts.map(part => {
                    const rem = getRemainingInPool(batchId, part);
                    return `${part}(${rem})`;
                }).join(', ');
                
                select.append(`<option value="${batchId}" data-piece="${pieceType}" data-min="${minAvailable}" data-parts="${requiredParts.join(',')}">
                    ${batchId} - ${pieceType} [${partDetails}] — ${minAvailable} complete sets available
                </option>`);
            }
        });
    }

    // ============================================================
    // Generate Rows - Each row = 1 worker = all parts together
    // ============================================================

    function generateRows(batchId, pieceType, minAvailable) {
        const container = $('#rowsContainer');
        container.empty();

        const requiredParts = getPartsForPieceType(pieceType);
        const partCount = requiredParts.length;
        
        // Worker dropdown options
        const workerOptions = '<option value="">Select Worker</option>' + 
            WORKERS.map(w => `<option value="${w}">${w}</option>`).join('');
        
        // Show availability info
        const partInfo = requiredParts.map(part => {
            const rem = getRemainingInPool(batchId, part);
            return `<span class="badge bg-info me-2">${part}: ${rem} available</span>`;
        }).join('');

        const splitControl = $(`
            <div class="alert alert-primary mb-3">
                <div class="row align-items-center">
                    <div class="col-md-5">
                        <i class="bx bx-layer me-2"></i>
                        <strong>${pieceType}</strong> — ${minAvailable} complete sets available
                        <br>
                        <small class="text-muted">Each worker gets all ${partCount} part(s)</small>
                        <br>
                        <small class="text-muted">${partInfo}</small>
                    </div>
                    <div class="col-md-7">
                        <label class="form-label mb-0">Number of Workers</label>
                        <div class="input-group">
                            <input type="number" class="form-control" id="splitCount" value="1" min="1" max="20">
                            <button class="btn btn-success" id="applySplitBtn" type="button">
                                <i class="bx bx-check"></i> Apply
                            </button>
                        </div>
                        <small class="text-muted">Each worker gets ${partCount} part(s) (${requiredParts.join(' + ')})</small>
                    </div>
                </div>
            </div>
        `);
        container.append(splitControl);

        function generateSplitRows(workerCount) {
            container.find('.table-responsive').remove();
            container.find('.alert-info').remove();
            container.find('.alert-success').remove();

            if (workerCount < 1) workerCount = 1;

            if (workerCount > minAvailable) {
                Swal.fire({ 
                    icon: 'warning', 
                    title: 'Too Many Workers', 
                    text: `Cannot create ${workerCount} workers for only ${minAvailable} available complete sets.`,
                    confirmButtonColor: '#3085d6' 
                });
                return;
            }

            const perWorker = Math.floor(minAvailable / workerCount);
            const extra = minAvailable % workerCount;

            container.append(`
                <div class="alert alert-info mb-2">
                    <i class="bx bx-info-circle me-2"></i>
                    ${workerCount} worker(s) × ${partCount} part(s) each = ${workerCount * partCount} rows
                    <span class="badge bg-success ms-2">${perWorker} sets per worker${extra > 0 ? ` (${extra} extra sets)` : ''}</span>
                </div>
            `);

            const tableHtml = `
                <div class="table-responsive">
                    <table class="table table-bordered table-sm mb-0">
                        <thead>
                            <tr>
                                <th style="width: 18%;">Worker</th>
                                <th style="width: 30%;">Part → Sub-Batch</th>
                                <th style="width: 12%;">Quantity</th>
                                <th style="width: 40%;">Delivery Date</th>
                            </tr>
                        </thead>
                        <tbody id="assignmentTableBody"></tbody>
                    </table>
                </div>
            `;
            container.append(tableHtml);

            const tbody = $('#assignmentTableBody');
            const defaultDeliveryDate = new Date();
            defaultDeliveryDate.setDate(defaultDeliveryDate.getDate() + 7);
            const defaultDateStr = defaultDeliveryDate.toISOString().split('T')[0];

            for (let w = 0; w < workerCount; w++) {
                let qty = perWorker;
                if (w < extra) qty += 1;
                
                const subBatchIds = generateIronSubBatchIds(batchId, pieceType, w);
                
                // Build parts display
                let partsHtml = '';
                requiredParts.forEach((part, idx) => {
                    const subId = subBatchIds[part];
                    partsHtml += `<span class="badge bg-info me-1">${part}: ${subId}</span>`;
                    if (idx < requiredParts.length - 1) partsHtml += ' ';
                });

                const row = $(`
                    <tr class="assignment-row">
                        <td>
                            <select class="form-select form-select-sm worker-select" required>
                                ${workerOptions}
                            </select>
                        </td>
                        <td>
                            ${partsHtml}
                            ${requiredParts.map(part => `<input type="hidden" class="sub-batch-input" data-part="${part}" value="${subBatchIds[part]}">`).join('')}
                        </td>
                        <td><input type="number" class="form-control form-control-sm quantity-input" value="${qty}" min="1" max="${minAvailable}"></td>
                        <td><input type="date" class="form-control form-control-sm delivery-date-input" value="${defaultDateStr}"></td>
                    </tr>
                `);
                tbody.append(row);
            }

            updateSummary();
            $('.quantity-input, .worker-select, .delivery-date-input').on('change input', function() { updateSummary(); });
        }

        function updateSummary() {
            let totalSets = 0, totalPieces = 0, assigned = 0, hasDeliveryDates = true;
            $('.assignment-row').each(function() {
                const qty = parseInt($(this).find('.quantity-input').val()) || 0;
                totalSets += qty;
                totalPieces += qty * requiredParts.length;
                if ($(this).find('.worker-select').val()) assigned++;
                if (!$(this).find('.delivery-date-input').val()) hasDeliveryDates = false;
            });

            let summary = container.find('.alert-success');
            if (summary.length === 0) {
                summary = $(`<div class="alert alert-success mt-2"></div>`);
                container.append(summary);
            }
            
            let summaryHtml = `<i class="bx bx-check-circle me-2"></i> <strong>${$('.assignment-row').length}</strong> workers | <strong>${assigned}</strong> selected | <strong>${totalSets}</strong> complete sets (${totalPieces} total pieces)`;
            
            if (totalSets === minAvailable) summaryHtml += ` | ✅ All ${minAvailable} sets assigned`;
            else if (totalSets < minAvailable) summaryHtml += ` | ℹ️ ${minAvailable - totalSets} sets remaining`;
            else summaryHtml += ` | ❌ Exceeds by ${totalSets - minAvailable}`;
            
            if (!hasDeliveryDates) summaryHtml += ` | ⚠️ Missing delivery dates`;
            summary.html(summaryHtml);
        }

        generateSplitRows(1);

        $('#applySplitBtn').off('click').on('click', function() {
            const workerCount = parseInt($('#splitCount').val()) || 1;
            generateSplitRows(workerCount);
        });

        $('#splitCount').off('keypress').on('keypress', function(e) {
            if (e.which === 13) { e.preventDefault(); $('#applySplitBtn').click(); }
        });
    }

    // ============================================================
    // Event Handlers
    // ============================================================

    $('#addTeamBtn').click(function() {
        const pool = getPoolData();
        const batchData = getBatchData();
        const batchIds = [...new Set(pool.map(item => item.batchId))];
        
        // Check if any batch has ALL required parts available
        let hasAvailable = false;
        for (const batchId of batchIds) {
            const pieceType = getPieceType(batchId);
            const requiredParts = getPartsForPieceType(pieceType);
            const allAvailable = requiredParts.every(part => getRemainingInPool(batchId, part) > 0);
            if (allAvailable) {
                hasAvailable = true;
                break;
            }
        }

        if (!hasAvailable) {
            Swal.fire({ 
                icon: 'warning', 
                title: 'No Complete Sets Available', 
                text: 'Ironing requires ALL parts of a piece type to be available from Stitching before assigning. Please wait for missing parts.\n\n- 1 Piece: Single\n- 2 Piece: Upper + Lower\n- 3 Piece: Upper + Jacket + Lower',
                confirmButtonColor: '#3085d6' 
            });
            return;
        }

        $('#teamModal').modal('show');
        $('#rowsContainer').empty();
        $('#partAvailabilityInfo').html('');
        populateBatchSelect();
    });

    $('#batchSelect').change(function() {
        const selected = $(this).find(':selected');
        const batchId = selected.val();
        const container = $('#rowsContainer');
        container.empty();
        $('#partAvailabilityInfo').html('');

        if (!batchId) return;

        const pieceType = selected.data('piece') || '1 Piece';
        const minAvailable = parseInt(selected.data('min')) || 0;
        const requiredParts = getPartsForPieceType(pieceType);
        const partCount = requiredParts.length;

        // Show availability info
        const partInfo = requiredParts.map(part => {
            const rem = getRemainingInPool(batchId, part);
            return `<span class="badge ${rem > 0 ? 'bg-success' : 'bg-danger'} me-2">${part}: ${rem}</span>`;
        }).join('');

        $('#partAvailabilityInfo').html(`
            <div class="alert alert-secondary py-2 mb-3">
                <i class="bx bx-info-circle me-1"></i> 
                <strong>${pieceType}</strong> requires ${partCount} part(s): ${partInfo}
                <br><small class="text-muted">Each worker gets all ${partCount} part(s). Complete sets available: ${minAvailable}</small>
            </div>
        `);

        if (minAvailable > 0) {
            generateRows(batchId, pieceType, minAvailable);
        } else {
            container.html(`<div class="alert alert-warning">Not enough complete ${pieceType} sets available.</div>`);
        }
    });

    // Save Assignment
    $('#saveTeamBtn').click(function() {
        const batchId = $('#batchSelect').val();
        const selected = $('#batchSelect').find(':selected');
        const pieceType = selected.data('piece') || '1 Piece';
        const requiredParts = getPartsForPieceType(pieceType);
        const minAvailable = parseInt(selected.data('min')) || 0;

        if (!batchId) {
            Swal.fire({ icon: 'warning', title: 'Select Batch', text: 'Please select a batch first.', confirmButtonColor: '#3085d6' });
            return;
        }

        // Verify all parts still have enough available
        for (const part of requiredParts) {
            const remaining = getRemainingInPool(batchId, part);
            if (remaining <= 0) {
                Swal.fire({ icon: 'warning', title: 'Part No Longer Available', text: `${part} is now ${remaining}. Please refresh and try again.`, confirmButtonColor: '#3085d6' });
                return;
            }
        }

        const rows = [];
        let isValid = true, errorMsg = '', totalSets = 0;

        $('.assignment-row').each(function() {
            const worker = $(this).find('.worker-select').val();
            const quantity = parseInt($(this).find('.quantity-input').val()) || 0;
            const deliveryDate = $(this).find('.delivery-date-input').val();
            
            // Get sub-batch IDs for each part
            const partSubBatches = {};
            $(this).find('.sub-batch-input').each(function() {
                const part = $(this).data('part');
                partSubBatches[part] = $(this).val();
            });

            if (!worker) { isValid = false; errorMsg = `Please select a worker for row ${rows.length + 1}`; return false; }
            if (quantity < 1) { isValid = false; errorMsg = `Please enter valid quantity for ${worker}`; return false; }
            if (!deliveryDate) { isValid = false; errorMsg = `Please select a delivery date for ${worker}`; return false; }

            totalSets += quantity;
            rows.push({ worker, quantity, deliveryDate, partSubBatches });
        });

        if (!isValid) {
            Swal.fire({ icon: 'warning', title: 'Incomplete Form', text: errorMsg, confirmButtonColor: '#3085d6' });
            return;
        }

        if (totalSets > minAvailable) {
            Swal.fire({ 
                icon: 'warning', 
                title: 'Quantity Exceeds Available', 
                text: `Total sets (${totalSets}) exceeds available (${minAvailable}).`,
                confirmButtonColor: '#3085d6' 
            });
            return;
        }

        const leftoverAfter = minAvailable - totalSets;

        let message = `<p><strong>Batch:</strong> ${batchId} | <strong>Type:</strong> ${pieceType}</p>`;
        message += `<p><strong>${totalSets} complete sets (${totalSets * requiredParts.length} total pieces):</strong></p><ul>`;
        rows.forEach(row => {
            const partsStr = requiredParts.map(p => `${p}: ${row.partSubBatches[p]}`).join(', ');
            message += `<li><strong>${row.worker}:</strong> ${row.quantity} sets (${partsStr}) - Delivery: ${formatDateDisplay(row.deliveryDate)}</li>`;
        });
        message += `</ul>`;
        if (leftoverAfter === 0) message += `<p class="text-success"><strong>After assignment: 0 sets remaining ✅</strong></p>`;
        else message += `<p class="text-primary"><strong>After assignment: ${leftoverAfter} sets will remain available.</strong></p>`;

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
                // Save all rows - each row creates one record per part
                rows.forEach(row => {
                    requiredParts.forEach(part => {
                        ironingData.push({
                            id: nextId++,
                            batchId,
                            part: part,
                            subBatch: row.partSubBatches[part],
                            worker: row.worker,
                            quantity: row.quantity,
                            progress: 0,
                            passedQty: 0,
                            fullyPassed: false,
                            deliveryDate: row.deliveryDate
                        });
                    });
                });

                // Update pool for all parts
                const pool = getPoolData();
                for (const part of requiredParts) {
                    const poolItem = pool.find(p => p.batchId === batchId && p.part === part);
                    if (poolItem) {
                        poolItem.assigned = (poolItem.assigned || 0) + totalSets;
                    }
                }
                updatePool(pool);

                saveData();
                renderTable();
                $('#teamModal').modal('hide');

                Swal.fire({
                    icon: 'success',
                    title: 'Assigned Successfully!',
                    text: `${rows.length} worker(s) assigned! ${totalSets} complete sets (${totalSets * requiredParts.length} pieces) assigned${leftoverAfter > 0 ? `, ${leftoverAfter} sets still available.` : '.'}`,
                    timer: 3000,
                    showConfirmButton: false
                });
            }
        });
    });

    // Update Progress button - show all parts for a worker together
    $(document).on('click', '.update-progress-btn', function() {
        const worker = $(this).data('worker');
        const batchId = $(this).data('batch');
        
        // Get all items for this worker + batch
        const items = ironingData.filter(i => i.worker === worker && i.batchId === batchId && !i.fullyPassed);
        if (items.length === 0) return;

        const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
        const totalProgress = items.reduce((sum, i) => sum + (i.progress || 0), 0);
        const totalPassed = items.reduce((sum, i) => sum + (i.passedQty || 0), 0);
        const partsList = items.map(i => i.part).join(' + ');

        $('#progressWorkerId').val(worker);
        $('#progressBatchId').val(batchId);
        $('#progressWorkerName').val(`${worker} — ${batchId} (${partsList})`);
        $('#progressCurrentDisplay').text(totalProgress);
        $('#progressTotalDisplay').text(totalQty);
        $('#progressAddQty').val(5);
        $('#progressExactQty').val('');

        const availableToPass = totalProgress - totalPassed;
        if (availableToPass > 0) {
            $('#passSection').show();
            $('#maxPassQty').text(availableToPass);
            $('#passQty').val(availableToPass);
        } else {
            $('#passSection').hide();
        }

        $('#progressModal').modal('show');
    });

    // Update progress for all parts of a worker together
    function updateWorkerProgress(worker, batchId, newProgressPerPart) {
        const items = ironingData.filter(i => i.worker === worker && i.batchId === batchId && !i.fullyPassed);
        items.forEach(item => {
            item.progress = Math.min(Math.max(newProgressPerPart, 0), item.quantity);
        });
        saveData();
        renderTable();
    }

    $('#addProgressBtn').click(function() {
        const worker = $('#progressWorkerId').val();
        const batchId = $('#progressBatchId').val();
        const items = ironingData.filter(i => i.worker === worker && i.batchId === batchId && !i.fullyPassed);
        if (items.length === 0) return;

        const addQty = parseInt($('#progressAddQty').val()) || 0;
        if (addQty <= 0) {
            Swal.fire({ icon: 'warning', title: 'Invalid Quantity', text: 'Please enter a valid quantity.', confirmButtonColor: '#3085d6' });
            return;
        }

        const currentPerPart = items[0].progress || 0;
        const maxPerPart = items[0].quantity;
        const newProgress = Math.min(currentPerPart + addQty, maxPerPart);
        
        updateWorkerProgress(worker, batchId, newProgress);

        const totalProgress = items.reduce((sum, i) => sum + (i.progress || 0), 0);
        const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
        const totalPassed = items.reduce((sum, i) => sum + (i.passedQty || 0), 0);
        
        const availableToPass = totalProgress - totalPassed;
        if (availableToPass > 0) {
            $('#passSection').show();
            $('#maxPassQty').text(availableToPass);
            $('#passQty').val(availableToPass);
        } else {
            $('#passSection').hide();
        }
        $('#progressCurrentDisplay').text(totalProgress);

        Swal.fire({ icon: 'success', title: 'Progress Updated!', text: `${totalProgress}/${totalQty} total pieces completed.`, timer: 2000, showConfirmButton: false });
    });

    $('#setProgressBtn').click(function() {
        const worker = $('#progressWorkerId').val();
        const batchId = $('#progressBatchId').val();
        const items = ironingData.filter(i => i.worker === worker && i.batchId === batchId && !i.fullyPassed);
        if (items.length === 0) return;

        const exactQty = parseInt($('#progressExactQty').val());
        if (isNaN(exactQty) || exactQty < 0) {
            Swal.fire({ icon: 'warning', title: 'Invalid Quantity', text: 'Please enter a valid quantity.', confirmButtonColor: '#3085d6' });
            return;
        }

        const maxPerPart = items[0].quantity;
        if (exactQty > maxPerPart) {
            Swal.fire({ icon: 'warning', title: 'Exceeds Limit', text: `Cannot exceed ${maxPerPart} per part.`, confirmButtonColor: '#3085d6' });
            return;
        }

        const passedPerPart = items[0].passedQty || 0;
        if (exactQty < passedPerPart) {
            Swal.fire({ icon: 'warning', title: 'Below Already-Passed Amount', text: `${passedPerPart} pieces already passed per part, progress can't go below that.`, confirmButtonColor: '#3085d6' });
            return;
        }

        updateWorkerProgress(worker, batchId, exactQty);

        const totalProgress = items.reduce((sum, i) => sum + (i.progress || 0), 0);
        const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
        const totalPassed = items.reduce((sum, i) => sum + (i.passedQty || 0), 0);
        
        const availableToPass = totalProgress - totalPassed;
        if (availableToPass > 0) {
            $('#passSection').show();
            $('#maxPassQty').text(availableToPass);
            $('#passQty').val(availableToPass);
        } else {
            $('#passSection').hide();
        }
        $('#progressCurrentDisplay').text(totalProgress);

        Swal.fire({ icon: 'success', title: 'Progress Set!', text: `${totalProgress}/${totalQty} total pieces completed.`, timer: 2000, showConfirmButton: false });
    });

    // Pass to Next Stage - pass all parts together
    $(document).on('click', '.pass-to-next-btn', function() {
        const worker = $(this).data('worker');
        const batchId = $(this).data('batch');
        const items = ironingData.filter(i => i.worker === worker && i.batchId === batchId && !i.fullyPassed);
        if (items.length === 0) return;
        
        const totalProgress = items.reduce((sum, i) => sum + (i.progress || 0), 0);
        const totalPassed = items.reduce((sum, i) => sum + (i.passedQty || 0), 0);
        const pendingToPass = totalProgress - totalPassed;
        
        if (pendingToPass <= 0) return;
        doPass(worker, batchId, pendingToPass, false);
    });

    $('#passToNextBtn').click(function() {
        const worker = $('#progressWorkerId').val();
        const batchId = $('#progressBatchId').val();
        const passQty = parseInt($('#passQty').val()) || 0;
        doPass(worker, batchId, passQty, true);
    });

    function doPass(worker, batchId, passQty, fromModal) {
        const items = ironingData.filter(i => i.worker === worker && i.batchId === batchId && !i.fullyPassed);
        if (items.length === 0) return;

        const totalProgress = items.reduce((sum, i) => sum + (i.progress || 0), 0);
        const totalPassed = items.reduce((sum, i) => sum + (i.passedQty || 0), 0);
        const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
        const availableToPass = totalProgress - totalPassed;

        if (passQty <= 0 || passQty > availableToPass) {
            Swal.fire({ icon: 'warning', title: 'Invalid Quantity', text: `Only ${availableToPass} pieces available to pass.`, confirmButtonColor: '#3085d6' });
            return;
        }

        // Pass per part (divide equally)
        const perPartPass = Math.floor(passQty / items.length);
        const stillOpen = totalQty - (totalPassed + passQty);
        const partsList = items.map(i => i.part).join(' + ');

        Swal.fire({
            title: 'Pass to Packing?',
            html: `
                <div class="text-start">
                    <p><strong>Worker:</strong> ${worker}</p>
                    <p><strong>Batch:</strong> ${batchId}</p>
                    <p><strong>Parts:</strong> ${partsList}</p>
                    <p><strong>Total Assigned:</strong> ${totalQty} pieces</p>
                    <p><strong>Already Passed:</strong> ${totalPassed} pieces</p>
                    <p class="text-success"><strong>Passing Now:</strong> ${passQty} pieces (${perPartPass} per part)</p>
                    ${stillOpen > 0 ? `<hr><p class="text-warning"><strong>Still to complete:</strong> ${stillOpen} pieces</p><p class="text-muted">This worker stays open — come back and pass the rest later.</p>` : `<hr><p class="text-success">All ${totalQty} pieces will be passed! ✅</p>`}
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
                // Pass per part
                items.forEach(item => {
                    const passPerPart = Math.floor(passQty / items.length);
                    pushToNextStage(item.batchId, item.part, passPerPart, item.worker);
                    item.passedQty = (item.passedQty || 0) + passPerPart;
                    if (item.passedQty >= item.quantity) {
                        item.fullyPassed = true;
                    }
                });

                saveData();
                renderTable();
                if (fromModal) $('#progressModal').modal('hide');

                const allFullyPassed = items.every(i => i.fullyPassed);
                Swal.fire({
                    icon: 'success',
                    title: allFullyPassed ? 'Fully Passed to Packing!' : 'Partially Passed!',
                    text: allFullyPassed ? `${worker} is complete — all ${totalQty} pieces passed.` : `${passQty} pieces sent to packing. ${totalQty - (totalPassed + passQty)} pieces still open.`,
                    timer: 3000,
                    showConfirmButton: false
                });
            }
        });
    }

    // Delete button - delete all parts for a worker together
    $(document).on('click', '.delete-btn', function() {
        const worker = $(this).data('worker');
        const batchId = $(this).data('batch');
        const items = ironingData.filter(i => i.worker === worker && i.batchId === batchId && !i.fullyPassed);
        if (items.length === 0) return;

        const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
        const totalPassed = items.reduce((sum, i) => sum + (i.passedQty || 0), 0);
        const partsList = items.map(i => i.part).join(' + ');

        Swal.fire({
            title: 'Are you sure?',
            html: `<div class="text-start">
                <p><strong>Worker:</strong> ${worker}</p>
                <p><strong>Batch:</strong> ${batchId}</p>
                <p><strong>Parts:</strong> ${partsList}</p>
                <p><strong>Total Quantity:</strong> ${totalQty} pieces</p>
                <p><strong>Already Passed:</strong> ${totalPassed} pieces</p>
            </div>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete all!',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                // Return un-passed quantity back to pool for each part
                items.forEach(item => {
                    const passedQty = item.passedQty || 0;
                    const toReturn = item.quantity - passedQty;
                    if (toReturn > 0) {
                        const pool = getPoolData();
                        const poolItem = pool.find(p => p.batchId === item.batchId && p.part === item.part);
                        if (poolItem) {
                            poolItem.assigned = Math.max(0, (poolItem.assigned || 0) - toReturn);
                            updatePool(pool);
                        }
                    }
                });

                // Remove all items for this worker
                const ids = items.map(i => i.id);
                ironingData = ironingData.filter(i => !ids.includes(i.id));
                saveData();
                renderTable();
                Swal.fire({ icon: 'success', title: 'Deleted!', text: 'Worker assignment has been deleted.', timer: 2000, showConfirmButton: false });
            }
        });
    });

    // Modal close handlers
    $('#teamModal').on('hidden.bs.modal', function() {
        $('#rowsContainer').empty();
        $('#batchSelect').val('');
        $('#partAvailabilityInfo').html('');
    });

    $('#progressModal').on('hidden.bs.modal', function() {
        $('#passSection').hide();
    });

    // ============================================================
    // Initial Render
    // ============================================================

    renderTable();
});