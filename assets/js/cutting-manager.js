$(document).ready(function() {
    // ============================================================
    // DATA PERSISTENCE - Load from localStorage
    // ============================================================
    
    const defaultBatchData = [
        { id: 1, batchId: 'BATCH-0001', brand: 'NIVI BLOSSOM', designNumber: 'D-1001', color: 'Red', quantity: 100, priority: 'High', createdAt: new Date().toLocaleDateString(), status: 'pending', photo: 'assets/images/batch1.jpg', pieceType: '1 Piece', checks: [] },
        { id: 2, batchId: 'BATCH-0002', brand: 'AMARI', designNumber: 'D-1002', color: 'Blue', quantity: 150, priority: 'Medium', createdAt: new Date().toLocaleDateString(), status: 'pending', photo: 'assets/images/batch2.jpg', pieceType: '2 Piece', checks: ['check1', 'check2'] },
        { id: 3, batchId: 'BATCH-0003', brand: 'LITTLE DOLLY', designNumber: 'D-1003', color: 'Green', quantity: 200, priority: 'Low', createdAt: new Date().toLocaleDateString(), status: 'approved', photo: 'assets/images/batch3.jpg', pieceType: '1 Piece', checks: ['check1', 'check2', 'check3', 'check4'] },
        { id: 4, batchId: 'BATCH-0004', brand: 'NIVI BLOSSOM', designNumber: 'D-1004', color: 'Yellow', quantity: 120, priority: 'High', createdAt: new Date().toLocaleDateString(), status: 'pending', photo: 'assets/images/batch4.jpg', pieceType: '3 Piece', checks: ['check1'] },
        { id: 5, batchId: 'BATCH-0005', brand: 'AMARI', designNumber: 'D-1005', color: 'Black', quantity: 200, priority: 'Medium', createdAt: new Date().toLocaleDateString(), status: 'pending', photo: 'assets/images/batch5.jpg', pieceType: '2 Piece', checks: ['check1', 'check2', 'check3'] },
        { id: 6, batchId: 'BATCH-0006', brand: 'LITTLE DOLLY', designNumber: 'D-1006', color: 'Pink', quantity: 80, priority: 'High', createdAt: new Date().toLocaleDateString(), status: 'pending', photo: 'assets/images/batch6.jpg', pieceType: '1 Piece', checks: [] }
    ];

    function loadData() {
        const savedBatchData = localStorage.getItem('cutting_batchData');
        const savedCuttingData = localStorage.getItem('cutting_cuttingData');
        const savedNextId = localStorage.getItem('cutting_nextId');
        const savedBatchSubBatchCounters = localStorage.getItem('cutting_batchSubBatchCounters');

        let batchData = savedBatchData ? JSON.parse(savedBatchData) : defaultBatchData;
        let cuttingData = savedCuttingData ? JSON.parse(savedCuttingData) : [];
        let nextId = savedNextId ? parseInt(savedNextId) : 1;
        let batchSubBatchCounters = savedBatchSubBatchCounters ? JSON.parse(savedBatchSubBatchCounters) : {};

        return { batchData, cuttingData, nextId, batchSubBatchCounters };
    }

    function saveData() {
        localStorage.setItem('cutting_batchData', JSON.stringify(batchData));
        localStorage.setItem('cutting_cuttingData', JSON.stringify(cuttingData));
        localStorage.setItem('cutting_nextId', String(nextId));
        localStorage.setItem('cutting_batchSubBatchCounters', JSON.stringify(batchSubBatchCounters));
    }

    let loaded = loadData();
    let batchData = loaded.batchData;
    let cuttingData = loaded.cuttingData;
    let nextId = loaded.nextId;
    let batchSubBatchCounters = loaded.batchSubBatchCounters;
    let currentEditingId = null;

    // ============================================================
    // Helper Functions
    // ============================================================
    
    // Format date to "10 September 2026" format
    function formatDateDisplay(dateString) {
        if (!dateString) return 'Not Set';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Not Set';
        
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
        
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        return `${day} ${month} ${year}`;
    }

    // Get delivery status for badge color only (no text)
    function getDeliveryStatusClass(deliveryDate) {
        if (!deliveryDate) return 'delivery-badge-secondary';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const delivery = new Date(deliveryDate);
        delivery.setHours(0, 0, 0, 0);
        
        const diffTime = delivery - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            return 'delivery-overdue';
        } else if (diffDays === 0) {
            return 'delivery-due-today';
        } else {
            return 'delivery-ontrack';
        }
    }

    function getAssignedQuantity(batchId) {
        let total = 0;
        cuttingData.forEach(item => {
            if (item.batchId === batchId && !item.fullyPassed) {
                total += parseInt(item.quantity);
            }
        });
        return total;
    }

    function getCompletedQuantity(batchId) {
        let total = 0;
        cuttingData.forEach(item => {
            if (item.batchId === batchId && !item.fullyPassed) {
                total += parseInt(item.progress || 0);
            }
        });
        return total;
    }

    function getRemainingQuantity(batchId) {
        const batch = batchData.find(b => b.batchId === batchId);
        if (!batch) return 0;
        const assigned = getAssignedQuantity(batchId);
        return batch.quantity - assigned;
    }

    function generateSubBatchId(batchId, pieceType, splitCount, index) {
        let formattedBatchId = batchId;
        if (!formattedBatchId.toString().includes('BATCH-')) {
            const paddedId = String(batchId).padStart(4, '0');
            formattedBatchId = `BATCH-${paddedId}`;
        }
        const num = index + 1;
        if (pieceType === '1 Piece') {
            return `${formattedBatchId}-C${num}`;
        } else if (pieceType === '2 Piece') {
            if (num % 2 === 1) {
                const group = Math.ceil(num / 2);
                return `${formattedBatchId}-U${group}`;
            } else {
                const group = num / 2;
                return `${formattedBatchId}-L${group}`;
            }
        } else if (pieceType === '3 Piece') {
            const group = Math.ceil(num / 3);
            const position = ((num - 1) % 3) + 1;
            if (position === 1) return `${formattedBatchId}-U${group}`;
            else if (position === 2) return `${formattedBatchId}-J${group}`;
            else return `${formattedBatchId}-L${group}`;
        } else {
            const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
            return `${formattedBatchId}-${letters[index]}${num}`;
        }
    }

    // Extract part from sub-batch ID: U1 -> Upper, L1 -> Lower, J1 -> Jacket, C1 -> Single
    function extractPart(subBatchId) {
        if (subBatchId.includes('-U')) return 'Upper';
        if (subBatchId.includes('-L')) return 'Lower';
        if (subBatchId.includes('-J')) return 'Jacket';
        if (subBatchId.includes('-C')) return 'Single';
        return 'Single';
    }

    function getBaseSplitCount(pieceType) {
        if (pieceType === '2 Piece') return 2;
        if (pieceType === '3 Piece') return 3;
        return 1;
    }

    // ============================================================
    // Push to Stitching Pool in localStorage
    // ============================================================
    function pushToStitchingPool(batchId, subBatchId, quantity, part) {
        let stitchingPool = JSON.parse(localStorage.getItem('stitching_pool') || '[]');
        
        // Find if this batch+part already exists in pool
        const existingIndex = stitchingPool.findIndex(item => 
            item.batchId === batchId && item.part === part
        );
        
        if (existingIndex !== -1) {
            stitchingPool[existingIndex].available += quantity;
            stitchingPool[existingIndex].subBatches.push(subBatchId);
        } else {
            stitchingPool.push({
                batchId: batchId,
                part: part,
                available: quantity,
                subBatches: [subBatchId],
                passed: 0,
                assigned: 0
            });
        }
        
        localStorage.setItem('stitching_pool', JSON.stringify(stitchingPool));
    }

    // ============================================================
    // Render Table
    // ============================================================
    function renderTable() {
        const tbody = $('#cuttingMastersList');
        tbody.empty();

        const activeItems = cuttingData.filter(item => !item.fullyPassed);

        if (activeItems.length === 0) {
            tbody.append(`<tr><td colspan="14" class="text-center text-muted py-4"><i class="bx bx-info-circle me-2"></i>No cutting assignments yet.</td></tr>`);
            return;
        }

        const groupedData = {};
        activeItems.forEach(item => {
            if (!groupedData[item.batchId]) groupedData[item.batchId] = [];
            groupedData[item.batchId].push(item);
        });

        let batchSerial = 0;

        Object.keys(groupedData).forEach((batchId) => {
            const items = groupedData[batchId];
            const batch = batchData.find(b => b.batchId === batchId);
            items.sort((a, b) => a.subBatch.localeCompare(b.subBatch));
            batchSerial++;

            items.forEach((item, index) => {
                const priorityClass = item.priority === 'High' ? 'text-danger' : item.priority === 'Medium' ? 'text-warning' : 'text-secondary';
                const progress = item.progress || 0;
                const passedQty = item.passedQty || 0;
                const remainingToWork = item.quantity - progress;
                const pendingToPass = progress - passedQty;
                const progressPercent = item.quantity > 0 ? Math.round((progress / item.quantity) * 100) : 0;

                let subStatusText = 'Pending';
                let subStatusClass = 'text-warning';
                if (passedQty > 0 && passedQty < item.quantity) {
                    subStatusText = `Partially Passed (${passedQty}/${item.quantity})`;
                    subStatusClass = 'text-info';
                } else if (progress === item.quantity) {
                    subStatusText = 'Complete ✅';
                    subStatusClass = 'text-success';
                } else if (progress > 0) {
                    subStatusText = 'In Progress';
                    subStatusClass = 'text-primary';
                }

                const showBatchId = index === 0 ? batchId : '';
                const showBrand = index === 0 ? (batch ? batch.brand : '') : '';

                // Delivery Date display - Only show date in "10 September 2026" format
                let deliveryDisplay = '<span class="text-muted">Not Set</span>';
                if (item.deliveryDate) {
                    const formattedDate = formatDateDisplay(item.deliveryDate);
                    const badgeClass = getDeliveryStatusClass(item.deliveryDate);
                    deliveryDisplay = `<span class="badge ${badgeClass} delivery-date-badge">${formattedDate}</span>`;
                }

                tbody.append(`
                    <tr>
                        <td>${index === 0 ? batchSerial : ''}</td>
                        <td>${showBatchId}</td>
                        <td>${item.subBatch}</td>
                        <td>${showBrand}</td>
                        <td>${item.pieceType}</td>
                        <td>${item.worker}</td>
                        <td>${item.quantity}</td>
                        <td>
                            <div class="d-flex align-items-center gap-2">
                                <span>${progress}</span>
                                <div class="progress-bar-container">
                                    <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
                                </div>
                            </div>
                        </td>
                        <td>${remainingToWork}</td>
                        <td>${item.size || 'N/A'}</td>
                        <td><span class="${priorityClass} fw-semibold">${item.priority}</span></td>
                        <td>${deliveryDisplay}</td>
                        <td><span class="${subStatusClass} fw-semibold">${subStatusText}</span></td>
                        <td>
                            <button class="btn btn-sm btn-primary progress-btn" data-id="${item.id}" title="Update Progress"><i class="bx bx-edit"></i></button>
                            ${pendingToPass > 0 ? `<button class="btn btn-sm btn-pass pass-stitching-btn" data-id="${item.id}" title="Pass ${pendingToPass} pcs to Stitching"><i class="bx bx-right-arrow-alt"></i> Pass ${pendingToPass}</button>` : ''}
                            <button class="btn btn-sm btn-danger delete-btn" data-id="${item.id}" title="Delete"><i class="bx bx-trash"></i></button>
                        </td>
                    </tr>
                `);
            });
        });
    }

    // ============================================================
    // Populate Batch Select
    // ============================================================
    function populateBatchSelect() {
        const select = $('#batchSelect');
        select.empty();
        select.append('<option value="">Choose Batch</option>');

        const pendingBatches = batchData.filter(b => b.status === 'pending' || b.status === 'cutting_assigned');

        pendingBatches.forEach(batch => {
            const pieceInfo = batch.pieceType || '1 Piece';
            const assigned = getAssignedQuantity(batch.batchId);
            const remaining = batch.quantity - assigned;
            if (remaining > 0) {
                select.append(`<option value="${batch.id}" data-piece="${pieceInfo}" data-quantity="${batch.quantity}" data-brand="${batch.brand}" data-remaining="${remaining}" data-assigned="${assigned}">
                    ${batch.batchId} - ${batch.brand} (${pieceInfo}) - ${remaining} remaining
                </option>`);
            }
        });
    }

    // ============================================================
    // Generate Table Rows in Modal
    // ============================================================
    function generateTableRows(pieceType, remaining, totalQuantity, assigned, batchId) {
        const container = $('#rowsContainer');
        container.empty();

        const baseSplit = getBaseSplitCount(pieceType);

        const splitControl = $(`
            <div class="alert alert-primary mb-3">
                <div class="row align-items-center">
                    <div class="col-md-5">
                        <i class="bx bx-layer me-2"></i>
                        <strong>${pieceType}</strong> - ${remaining} pieces remaining
                        <br>
                        <small class="text-muted">Batch Total: ${totalQuantity} | Already Assigned: ${assigned}</small>
                    </div>
                    <div class="col-md-7">
                        <label class="form-label mb-0">Split Multiplier (x${baseSplit} columns)</label>
                        <div class="input-group">
                            <input type="number" class="form-control" id="splitCount" value="1" min="1" max="20">
                            <button class="btn btn-success" id="applySplitBtn" type="button">
                                <i class="bx bx-check"></i> Apply Split
                            </button>
                        </div>
                        <small class="text-muted">1 = ${baseSplit} row(s) by default</small>
                    </div>
                </div>
            </div>
        `);
        container.append(splitControl);

        function getStartOffset() {
            return batchSubBatchCounters[batchId] || 0;
        }

        function generateSplitRows(multiplier) {
            container.find('.table-responsive').remove();
            container.find('.alert-info').remove();

            if (multiplier < 1) multiplier = 1;
            const actualCount = baseSplit * multiplier;

            if (actualCount > remaining) {
                Swal.fire({ icon: 'warning', title: 'Too Many Rows', text: `Cannot create ${actualCount} rows for only ${remaining} remaining pieces.`, confirmButtonColor: '#3085d6' });
                return;
            }

            const startOffset = getStartOffset();
            const baseQty = Math.floor(remaining / actualCount);
            const extra = remaining % actualCount;

            container.append(`
                <div class="alert alert-info mb-2">
                    <i class="bx bx-info-circle me-2"></i>
                    Splitting ${remaining} pieces into ${actualCount} row(s)
                    <span class="badge bg-success ms-2">${baseQty} each${extra > 0 ? ` (${extra} extra)` : ''}</span>
                </div>
            `);

            const tableHtml = `
                <div class="table-responsive">
                    <table class="table table-bordered table-sm mb-0">
                        <thead>
                            <tr>
                                <th style="width: 15%;">Sub-Batch ID</th>
                                <th style="width: 20%;">Worker Name</th>
                                <th style="width: 12%;">Quantity</th>
                                <th style="width: 12%;">Size</th>
                                <th style="width: 16%;">Priority</th>
                                <th style="width: 25%;">Delivery Date</th>
                            </tr>
                        </thead>
                        <tbody id="assignmentTableBody"></tbody>
                    </table>
                </div>
            `;
            container.append(tableHtml);

            const tbody = $('#assignmentTableBody');

            // Calculate default delivery date (17 days from now)
            const defaultDeliveryDate = new Date();
            defaultDeliveryDate.setDate(defaultDeliveryDate.getDate() + 17);
            const defaultDateStr = defaultDeliveryDate.toISOString().split('T')[0];

            for (let i = 0; i < actualCount; i++) {
                let qty = baseQty;
                if (i < extra) qty += 1;
                const overallIndex = startOffset + i;
                const subBatchId = generateSubBatchId(batchId, pieceType, actualCount, overallIndex);

                const row = $(`
                    <tr class="assignment-row">
                        <td><span class="sub-batch-label">${subBatchId}</span><input type="hidden" class="sub-batch-input" value="${subBatchId}"></td>
                        <td>
                            <select class="form-select form-select-sm worker-select" required>
                                <option value="">Select Worker</option>
                                <option value="Ahmad Khan">Ahmad Khan</option>
                                <option value="Bilal Ahmed">Bilal Ahmed</option>
                                <option value="Danish Ali">Danish Ali</option>
                                <option value="Faisal Khan">Faisal Khan</option>
                                <option value="Usman Malik">Usman Malik</option>
                                <option value="Ali Ahmed">Ali Ahmed</option>
                                <option value="Imran Khan">Imran Khan</option>
                                <option value="Saeed Ahmad">Saeed Ahmad</option>
                                <option value="Zafar Iqbal">Zafar Iqbal</option>
                                <option value="Rashid Mahmood">Rashid Mahmood</option>
                            </select>
                        </td>
                        <td><input type="number" class="form-control form-control-sm quantity-input" value="${qty}" min="1" max="${remaining}"></td>
                        <td>
                            <select class="form-select form-select-sm size-select">
                                <option value="S">S</option><option value="M" selected>M</option>
                                <option value="L">L</option><option value="XL">XL</option>
                            </select>
                        </td>
                        <td>
                            <select class="form-select form-select-sm priority-select">
                                <option value="Low">Low</option><option value="Medium" selected>Medium</option><option value="High">High</option>
                            </select>
                        </td>
                        <td>
                            <input type="date" class="form-control form-control-sm delivery-date-input" value="${defaultDateStr}">
                            <small class="text-muted">Default: 17 days from now</small>
                        </td>
                    </tr>
                `);
                tbody.append(row);
            }

            updateSummary();
            $('.quantity-input, .worker-select, .size-select, .priority-select, .delivery-date-input').on('change input', function() { updateSummary(); });
            updateSummary();
        }

        function updateSummary() {
            let total = 0, workers = 0, hasDeliveryDates = true;
            $('.assignment-row').each(function() {
                const qty = parseInt($(this).find('.quantity-input').val()) || 0;
                total += qty;
                if ($(this).find('.worker-select').val()) workers++;
                const deliveryDate = $(this).find('.delivery-date-input').val();
                if (!deliveryDate) hasDeliveryDates = false;
            });

            const remainingNow = parseInt($('#batchSelect').find(':selected').data('remaining')) || 0;
            let summary = container.find('.alert-success');
            if (summary.length === 0) {
                summary = $(`<div class="alert alert-success mt-2"></div>`);
                container.append(summary);
            }
            let summaryHtml = `<i class="bx bx-check-circle me-2"></i> <strong>${$('.assignment-row').length}</strong> rows | <strong>${workers}</strong> workers selected | <strong>${total}</strong> pieces to assign`;
            if (total === remainingNow) summaryHtml += ` | ✅ All ${remainingNow} pieces assigned`;
            else if (total < remainingNow) summaryHtml += ` | ℹ️ ${remainingNow - total} pieces remaining for later`;
            else summaryHtml += ` | ❌ Exceeds by ${total - remainingNow}`;
            if (!hasDeliveryDates) summaryHtml += ` | ⚠️ Missing delivery dates`;
            summary.html(summaryHtml);
        }

        generateSplitRows(1);

        $('#applySplitBtn').click(function() {
            const multiplier = parseInt($('#splitCount').val()) || 1;
            generateSplitRows(multiplier);
        });

        $('#splitCount').keypress(function(e) {
            if (e.which === 13) { e.preventDefault(); $('#applySplitBtn').click(); }
        });
    }

    // ============================================================
    // Event Handlers
    // ============================================================

    // Show assign modal
    $('#assignCuttingBtn').click(function() {
        $('#assignModal').modal('show');
        populateBatchSelect();
        $('#rowsContainer').empty();
    });

    // Batch selection change
    $('#batchSelect').change(function() {
        const selected = $(this).find(':selected');
        const batchId = selected.val();
        if (!batchId) { $('#rowsContainer').empty(); return; }
        const pieceType = selected.data('piece') || '1 Piece';
        const totalQuantity = selected.data('quantity') || 0;
        const remaining = selected.data('remaining') || totalQuantity;
        const assigned = selected.data('assigned') || 0;
        generateTableRows(pieceType, remaining, totalQuantity, assigned, batchId);
    });

    // Save Assignment
    $('#saveAssignBtn').click(function() {
        const batchId = $('#batchSelect').val();
        if (!batchId) {
            Swal.fire({ icon: 'warning', title: 'Select Batch', text: 'Please select a batch first.', confirmButtonColor: '#3085d6' });
            return;
        }

        const batch = batchData.find(b => b.id == batchId);
        if (!batch) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Batch not found!', confirmButtonColor: '#3085d6' });
            return;
        }

        const remaining = getRemainingQuantity(batch.batchId);
        if (remaining === 0) {
            Swal.fire({ icon: 'warning', title: 'Batch Complete', text: 'All pieces for this batch have already been assigned!', confirmButtonColor: '#3085d6' });
            return;
        }

        const rows = [];
        let isValid = true, errorMsg = '', totalAssigned = 0;

        $('.assignment-row').each(function() {
            const subBatch = $(this).find('.sub-batch-input').val() || $(this).find('.sub-batch-label').text();
            const worker = $(this).find('.worker-select').val();
            const quantity = parseInt($(this).find('.quantity-input').val()) || 0;
            const size = $(this).find('.size-select').val() || 'M';
            const priority = $(this).find('.priority-select').val() || 'Medium';
            const deliveryDate = $(this).find('.delivery-date-input').val();

            if (!worker) { isValid = false; errorMsg = `Please select a worker for ${subBatch}`; return false; }
            if (quantity < 1) { isValid = false; errorMsg = `Please enter valid quantity for ${subBatch}`; return false; }
            if (!deliveryDate) { isValid = false; errorMsg = `Please select a delivery date for ${subBatch}`; return false; }
            totalAssigned += quantity;
            rows.push({ subBatch, worker, quantity, size, priority, deliveryDate });
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
        let message = `<p><strong>Batch:</strong> ${batch.batchId} - ${batch.brand}</p>`;
        message += `<p><strong>Piece Type:</strong> ${batch.pieceType}</p>`;
        message += `<p><strong>Total Quantity:</strong> ${batch.quantity} pieces</p>`;
        message += `<p><strong>Previously Assigned:</strong> ${batch.quantity - remaining} pieces</p>`;
        message += `<p><strong>Now Assigning (${rows.length} rows):</strong></p><ul>`;
        rows.forEach(row => {
            const formattedDate = row.deliveryDate ? formatDateDisplay(row.deliveryDate) : 'Not set';
            message += `<li><strong>${row.subBatch}:</strong> ${row.worker} - ${row.quantity} pcs (Size: ${row.size}) - ${row.priority} - Delivery: ${formattedDate}</li>`;
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
                    cuttingData.push({
                        id: nextId++,
                        batchId: batch.batchId,
                        brand: batch.brand,
                        pieceType: batch.pieceType,
                        worker: row.worker,
                        quantity: row.quantity,
                        size: row.size || 'N/A',
                        priority: row.priority,
                        subBatch: row.subBatch,
                        progress: 0,
                        passedQty: 0,
                        fullyPassed: false,
                        deliveryDate: row.deliveryDate
                    });
                });

                batchSubBatchCounters[batch.batchId] = (batchSubBatchCounters[batch.batchId] || 0) + rows.length;
                saveData();
                renderTable();
                populateBatchSelect();
                $('#assignModal').modal('hide');

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

    // Progress button
    $(document).on('click', '.progress-btn', function() {
        const id = parseInt($(this).data('id'));
        const item = cuttingData.find(d => d.id === id);
        if (!item) return;
        currentEditingId = id;
        $('#progressSubBatch').val(item.subBatch);
        $('#progressWorker').val(item.worker);
        $('#progressTotal').val(item.quantity);
        $('#progressMax').text(item.quantity);
        $('#progressCompleted').val(item.progress || 0);
        $('#progressModal').modal('show');
    });

    // Update Progress
    $('#updateProgressBtn').click(function() {
        const id = currentEditingId;
        const item = cuttingData.find(d => d.id === id);
        if (!item) return;

        const completed = parseInt($('#progressCompleted').val()) || 0;
        const max = parseInt($('#progressMax').text()) || 0;
        const alreadyPassed = item.passedQty || 0;

        if (completed < 0) {
            Swal.fire({ icon: 'warning', title: 'Invalid Input', text: 'Completed quantity cannot be negative.', confirmButtonColor: '#3085d6' });
            return;
        }
        if (completed > max) {
            Swal.fire({ icon: 'warning', title: 'Exceeds Assigned', text: `Completed quantity (${completed}) cannot exceed assigned (${max}).`, confirmButtonColor: '#3085d6' });
            return;
        }
        if (completed < alreadyPassed) {
            Swal.fire({ icon: 'warning', title: 'Below Already-Passed Amount', text: `${alreadyPassed} pieces already passed, progress can't go below that.`, confirmButtonColor: '#3085d6' });
            return;
        }

        item.progress = completed;
        saveData();
        renderTable();
        $('#progressModal').modal('hide');

        Swal.fire({ icon: 'success', title: 'Updated!', text: `Progress updated to ${completed}/${max} pieces.`, timer: 2000, showConfirmButton: false });
    });

    // ============================================================
    // PASS TO STITCHING - Push to Stitching Pool
    // ============================================================
    $(document).on('click', '.pass-stitching-btn', function() {
        const id = parseInt($(this).data('id'));
        const item = cuttingData.find(d => d.id === id && !d.fullyPassed);
        if (!item) return;

        const progress = item.progress || 0;
        const alreadyPassed = item.passedQty || 0;
        const pendingToPass = progress - alreadyPassed;
        const quantity = item.quantity;
        const stillToFinish = quantity - progress;
        const part = extractPart(item.subBatch);

        if (pendingToPass <= 0) {
            Swal.fire({ icon: 'warning', title: 'Nothing New to Pass', text: 'All completed pieces have already been passed. Update progress first.', confirmButtonColor: '#3085d6' });
            return;
        }

        Swal.fire({
            title: 'Pass to Stitching?',
            html: `
                <div class="text-start">
                    <p><strong>Sub-Batch:</strong> ${item.subBatch}</p>
                    <p><strong>Part:</strong> ${part}</p>
                    <p><strong>Worker:</strong> ${item.worker}</p>
                    <p><strong>Total Assigned:</strong> ${quantity} pieces</p>
                    <p><strong>Already Passed:</strong> ${alreadyPassed} pieces</p>
                    <p class="text-success"><strong>Passing Now:</strong> ${pendingToPass} pieces</p>
                    ${stillToFinish > 0 ? `
                        <hr>
                        <p class="text-warning"><strong>Still to complete:</strong> ${stillToFinish} pieces</p>
                        <p class="text-muted">This sub-batch stays open — come back and pass the rest later.</p>
                    ` : `
                        <hr>
                        <p class="text-success">All ${quantity} pieces will be passed! ✅</p>
                    `}
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: `Yes, pass ${pendingToPass}`,
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                // Push to Stitching Pool
                pushToStitchingPool(item.batchId, item.subBatch, pendingToPass, part);

                item.passedQty = alreadyPassed + pendingToPass;
                if (item.passedQty >= item.quantity) {
                    item.fullyPassed = true;
                }

                saveData();
                renderTable();
                populateBatchSelect();

                if (!item.fullyPassed) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Partially Passed!',
                        html: `<p><strong>${item.subBatch}</strong>: ${pendingToPass} pieces sent to stitching</p><p class="text-muted">${stillToFinish} pieces still open on this sub-batch.</p>`,
                        timer: 3000,
                        showConfirmButton: false
                    });
                } else {
                    Swal.fire({
                        icon: 'success',
                        title: 'Fully Passed to Stitching!',
                        text: `${item.subBatch} is complete — all ${quantity} pieces passed.`,
                        timer: 3000,
                        showConfirmButton: false
                    });
                }
            }
        });
    });

    // Delete button
    $(document).on('click', '.delete-btn', function() {
        const id = parseInt($(this).data('id'));
        const item = cuttingData.find(d => d.id === id);
        if (!item) return;

        Swal.fire({
            title: 'Are you sure?',
            html: `<div class="text-start"><p><strong>Worker:</strong> ${item.worker}</p><p><strong>Batch:</strong> ${item.batchId}</p><p><strong>Sub-Batch:</strong> ${item.subBatch}</p><p><strong>Quantity:</strong> ${item.quantity} pieces</p><p><strong>Size:</strong> ${item.size}</p></div>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                cuttingData = cuttingData.filter(d => d.id !== id);
                saveData();
                renderTable();
                populateBatchSelect();
                Swal.fire({ icon: 'success', title: 'Deleted!', text: 'Assignment has been deleted.', timer: 2000, showConfirmButton: false });
            }
        });
    });

    // Modal close handlers
    $('#assignModal').on('hidden.bs.modal', function() {
        $('#rowsContainer').empty();
        $('#assignForm')[0].reset();
    });

    $('#progressModal').on('hidden.bs.modal', function() {
        currentEditingId = null;
    });

    // Initial render
    populateBatchSelect();
    renderTable();
});