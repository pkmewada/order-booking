$(document).ready(function() {
    // Initial data
    let stockData = [];
    let nextId = 1;

    // Generate stock code
    function generateStockCode() {
        const prefix = 'STK';
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        return `${prefix}-${year}${month}${day}-${random}`;
    }

    // Calculate pairs
    function calculatePairs(upper, lower) {
        return Math.min(upper, lower);
    }

    // Initialize
    renderAll();

    // Render all
    function renderAll() {
        renderStock();
        updateSummary();
        renderNotifications();
        updateCounts();
    }

    // Render Stock Table
    function renderStock() {
        const tbody = $('#stockList');
        tbody.empty();

        if (stockData.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="9" class="text-center text-muted">
                        <i class="bx bx-info-circle me-2"></i>No stock received yet.
                    </td>
                </tr>
            `);
            return;
        }

        stockData.forEach((item, index) => {
            const pairs = calculatePairs(item.upperQty, item.lowerQty);
            const statusClass = item.status === 'inventory' ? 'bg-success' : 'bg-warning';
            const statusText = item.status === 'inventory' ? 'In Inventory ✓' : 'Pending Verification';
            const receivedDate = item.receivedDate ? new Date(item.receivedDate).toLocaleDateString() : '-';
            
            tbody.append(`
                <tr>
                    <td>${index + 1}</td>
                    <td><span class="badge bg-primary">${item.stockCode}</span></td>
                    <td><strong>${item.name}</strong></td>
                    <td><span class="badge bg-primary">${item.upperQty}</span></td>
                    <td><span class="badge bg-warning">${item.lowerQty}</span></td>
                    <td><span class="badge bg-success fs-6">${pairs}</span></td>
                    <td>${receivedDate}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>
                        ${item.status === 'pending' ? `
                            <button class="btn btn-sm btn-success verify-btn" 
                                    data-id="${item.id}"
                                    title="Verify & Enter Inventory">
                                <i class="bx bx-check-shield"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-danger delete-btn" 
                                data-id="${item.id}"
                                title="Delete">
                            <i class="bx bx-trash"></i>
                        </button>
                    </td>
                </tr>
            `);
        });
    }

    // Update summary cards
    function updateSummary() {
        let totalProducts = stockData.length;
        let totalPairs = 0;
        let pending = 0;
        let inStock = 0;

        stockData.forEach(item => {
            const pairs = calculatePairs(item.upperQty, item.lowerQty);
            totalPairs += pairs;
            if (item.status === 'inventory') {
                inStock++;
            } else {
                pending++;
            }
        });

        $('#totalProducts').text(totalProducts);
        $('#totalPairs').text(totalPairs);
        $('#pendingReceive').text(pending);
        $('#inStockCount').text(inStock);
    }

    // Update counts
    function updateCounts() {
        $('#stockCount').text(stockData.length);
    }

    // Render notifications
    function renderNotifications() {
        const container = $('#notificationList');
        container.empty();

        const pendingItems = stockData.filter(item => item.status === 'pending');
        const inventoryItems = stockData.filter(item => item.status === 'inventory');

        if (inventoryItems.length > 0) {
            inventoryItems.forEach(item => {
                const pairs = calculatePairs(item.upperQty, item.lowerQty);
                container.append(`
                    <div class="alert alert-success mb-0 d-flex align-items-center">
                        <i class="bx bx-check-circle me-2"></i>
                        <span><strong>${item.name}</strong> (${item.stockCode}) - ${pairs} pairs entered into inventory</span>
                    </div>
                `);
            });
        }

        if (pendingItems.length > 0) {
            pendingItems.forEach(item => {
                const pairs = calculatePairs(item.upperQty, item.lowerQty);
                container.append(`
                    <div class="alert alert-warning mb-0 d-flex align-items-center">
                        <i class="bx bx-hourglass me-2"></i>
                        <span><strong>${item.name}</strong> (${item.stockCode}) - ${pairs} pairs pending verification</span>
                    </div>
                `);
            });
        }

        if (pendingItems.length === 0 && inventoryItems.length === 0) {
            container.append(`
                <div class="alert alert-secondary mb-0">
                    <i class="bx bx-info-circle me-2"></i>
                    No stock received yet. Receive garments to start inventory.
                </div>
            `);
        }

        // Client notification for complete process
        if (stockData.length > 0 && pendingItems.length === 0) {
            container.append(`
                <div class="alert alert-info mb-0 d-flex align-items-center">
                    <i class="bx bx-bell me-2"></i>
                    <strong>Client Notification:</strong> All garments have been processed and are ready for dispatch.
                </div>
            `);
        }
    }

    // Update total pairs display
    function updateTotalPairs() {
        const upper = parseInt($('#upperQty').val()) || 0;
        const lower = parseInt($('#lowerQty').val()) || 0;
        const pairs = calculatePairs(upper, lower);
        $('#totalPairsDisplay').text(pairs);
    }

    // Generate stock code in modal
    function updateStockCode() {
        const code = generateStockCode();
        $('#generatedStockCode').text(code);
        $('#stockCode').val(code);
    }

    // Reset form
    function resetForm() {
        $('#stockForm')[0].reset();
        $('#editId').val('');
        $('#totalPairsDisplay').text('0');
        $('#stockModalLabel').text('Receive Stock');
        updateStockCode();
    }

    // Show receive modal
    $('#receiveStockBtn').click(function() {
        resetForm();
        $('#stockModal').modal('show');
    });

    // Update pairs on quantity change
    $('#upperQty, #lowerQty').on('input', function() {
        updateTotalPairs();
        // Regenerate stock code when quantities change
        updateStockCode();
    });

    // Save stock
    $('#saveStockBtn').click(function() {
        const editId = $('#editId').val();
        const name = $('#productName').val().trim();
        const upperQty = parseInt($('#upperQty').val()) || 0;
        const lowerQty = parseInt($('#lowerQty').val()) || 0;
        const stockCode = $('#stockCode').val();

        if (!name) {
            Swal.fire({
                icon: 'warning',
                title: 'Incomplete Form',
                text: 'Please enter product name.',
                confirmButtonColor: '#3085d6',
                confirmButtonText: 'OK'
            });
            return;
        }

        if (upperQty === 0 || lowerQty === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Quantity',
                text: 'Both upper and lower quantities must be greater than 0.',
                confirmButtonColor: '#3085d6',
                confirmButtonText: 'OK'
            });
            return;
        }

        const pairs = calculatePairs(upperQty, lowerQty);
        if (pairs === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No Pairs Possible',
                text: 'Cannot create pairs with zero quantity.',
                confirmButtonColor: '#3085d6',
                confirmButtonText: 'OK'
            });
            return;
        }

        if (editId) {
            // Edit existing
            const index = stockData.findIndex(item => item.id === parseInt(editId));
            if (index !== -1) {
                stockData[index] = {
                    ...stockData[index],
                    name: name,
                    upperQty: upperQty,
                    lowerQty: lowerQty,
                    stockCode: stockCode
                };
            }
            Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: 'Stock updated successfully!',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            // Add new
            const newStock = {
                id: nextId++,
                name: name,
                upperQty: upperQty,
                lowerQty: lowerQty,
                stockCode: stockCode,
                receivedDate: new Date().toISOString(),
                status: 'pending'
            };
            stockData.push(newStock);
            Swal.fire({
                icon: 'success',
                title: 'Stock Received!',
                text: `Stock code ${stockCode} created successfully!`,
                timer: 2000,
                showConfirmButton: false
            });
        }

        renderAll();
        $('#stockModal').modal('hide');
    });

    // Verify button
    $(document).on('click', '.verify-btn', function() {
        const id = parseInt($(this).data('id'));
        const item = stockData.find(s => s.id === id);
        
        if (!item) return;

        const pairs = calculatePairs(item.upperQty, item.lowerQty);
        
        $('#verifyStockId').val(id);
        $('#verifyProductName').text(item.name);
        $('#verifyStockCode').text(item.stockCode);
        $('#verifyUpper').text(item.upperQty);
        $('#verifyLower').text(item.lowerQty);
        $('#verifyPairs').text(pairs);

        $('#verifyModal').modal('show');
    });

    // Confirm Verify
    $('#confirmVerifyBtn').click(function() {
        const id = parseInt($('#verifyStockId').val());
        const item = stockData.find(s => s.id === id);
        
        if (!item) return;

        item.status = 'inventory';
        renderAll();
        $('#verifyModal').modal('hide');

        const pairs = calculatePairs(item.upperQty, item.lowerQty);
        Swal.fire({
            icon: 'success',
            title: 'Inventory Updated!',
            text: `${item.name} - ${pairs} pairs entered into inventory. Stock code: ${item.stockCode}`,
            timer: 3000,
            showConfirmButton: false
        });
    });

    // Delete button
    $(document).on('click', '.delete-btn', function() {
        const id = parseInt($(this).data('id'));
        const item = stockData.find(s => s.id === id);
        
        if (!item) return;

        Swal.fire({
            title: 'Are you sure?',
            html: `You are about to delete <strong>${item.name}</strong> (${item.stockCode})`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                stockData = stockData.filter(s => s.id !== id);
                renderAll();
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Stock entry has been deleted successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        });
    });

    // Modal close handlers
    $('#stockModal').on('hidden.bs.modal', function() {
        resetForm();
    });

    // Initial render
    renderAll();
});