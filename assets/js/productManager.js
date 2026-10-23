$(document).ready(function() {
    // Initial data
    let productData = [];

    let nextId = 1;

    // Initialize
    renderAll();

    // Render all
    function renderAll() {
        renderProducts();
        updateSummary();
        renderNotifications();
        updateCounts();
    }

    // Calculate pairs
    function calculatePairs(upper, lower) {
        return Math.min(upper, lower);
    }

    // Render Products Table
    function renderProducts() {
        const tbody = $('#productsList');
        tbody.empty();

        if (productData.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="7" class="text-center text-muted">
                        <i class="bx bx-info-circle me-2"></i>No products created yet.
                    </td>
                </tr>
            `);
            return;
        }

        productData.forEach((product, index) => {
            const pairs = calculatePairs(product.upperQty, product.lowerQty);
            const statusClass = product.status === 'complete' ? 'bg-success' : 
                               product.status === 'inprogress' ? 'bg-warning' : 'bg-secondary';
            const statusText = product.status === 'complete' ? 'Complete ✓' : 
                              product.status === 'inprogress' ? 'In Progress' : 'Pending';
            
            tbody.append(`
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${product.name}</strong></td>
                    <td><span class="badge bg-primary">${product.upperQty}</span></td>
                    <td><span class="badge bg-warning">${product.lowerQty}</span></td>
                    <td><span class="badge bg-success fs-6">${pairs}</span></td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-btn" 
                                data-id="${product.id}"
                                title="Edit">
                            <i class="bx bx-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-success complete-btn" 
                                data-id="${product.id}"
                                title="Complete Product">
                            <i class="bx bx-check-circle"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-btn" 
                                data-id="${product.id}"
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
        let total = productData.length;
        let ready = 0;
        let inProgress = 0;
        let pending = 0;

        productData.forEach(product => {
            if (product.status === 'complete') {
                ready++;
            } else if (product.status === 'inprogress') {
                inProgress++;
            } else {
                pending++;
            }
        });

        $('#summaryTotalProducts').text(total);
        $('#summaryReadyProducts').text(ready);
        $('#summaryInProgress').text(inProgress);
        $('#summaryPending').text(pending);
    }

    // Update counts
    function updateCounts() {
        $('#productCount').text(productData.length);
    }

    // Render notifications
    function renderNotifications() {
        const container = $('#notificationList');
        container.empty();

        const readyProducts = productData.filter(p => p.status === 'complete');
        const inProgressProducts = productData.filter(p => p.status === 'inprogress');

        if (readyProducts.length > 0) {
            readyProducts.forEach(product => {
                const pairs = calculatePairs(product.upperQty, product.lowerQty);
                container.append(`
                    <div class="alert alert-success mb-0 d-flex align-items-center">
                        <i class="bx bx-check-circle me-2"></i>
                        <span><strong>${product.name}</strong> - ${pairs} complete garments ready for stock!</span>
                    </div>
                `);
            });
        }

        if (inProgressProducts.length > 0) {
            inProgressProducts.forEach(product => {
                const pairs = calculatePairs(product.upperQty, product.lowerQty);
                container.append(`
                    <div class="alert alert-info mb-0 d-flex align-items-center">
                        <i class="bx bx-loader-circle me-2"></i>
                        <span><strong>${product.name}</strong> - ${pairs} pairs assembled (${product.upperQty} upper, ${product.lowerQty} lower)</span>
                    </div>
                `);
            });
        }

        if (readyProducts.length === 0 && inProgressProducts.length === 0) {
            container.append(`
                <div class="alert alert-secondary mb-0">
                    <i class="bx bx-info-circle me-2"></i>
                    No products created yet. Start by adding a product.
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

    // Reset form
    function resetForm() {
        $('#productForm')[0].reset();
        $('#editId').val('');
        $('#totalPairsDisplay').text('0');
        $('#productModalLabel').text('Add Product');
    }

    // Show add modal
    $('#addProductBtn').click(function() {
        resetForm();
        $('#productModal').modal('show');
    });

    // Update pairs on quantity change
    $('#upperQty, #lowerQty').on('input', updateTotalPairs);

    // Save product
    $('#saveProductBtn').click(function() {
        const editId = $('#editId').val();
        const name = $('#productName').val().trim();
        const upperQty = parseInt($('#upperQty').val()) || 0;
        const lowerQty = parseInt($('#lowerQty').val()) || 0;

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
            const index = productData.findIndex(p => p.id === parseInt(editId));
            if (index !== -1) {
                const oldStatus = productData[index].status;
                productData[index] = {
                    ...productData[index],
                    name: name,
                    upperQty: upperQty,
                    lowerQty: lowerQty
                };
                // Keep status if not complete, or reset if quantities changed
                if (oldStatus === 'complete' && 
                    (productData[index].upperQty !== upperQty || productData[index].lowerQty !== lowerQty)) {
                    productData[index].status = 'inprogress';
                }
            }
            Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: 'Product updated successfully!',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            // Add new
            const newProduct = {
                id: nextId++,
                name: name,
                upperQty: upperQty,
                lowerQty: lowerQty,
                status: 'pending'
            };
            productData.push(newProduct);
            Swal.fire({
                icon: 'success',
                title: 'Added!',
                text: 'Product added successfully!',
                timer: 2000,
                showConfirmButton: false
            });
        }

        renderAll();
        $('#productModal').modal('hide');
    });

    // Edit button
    $(document).on('click', '.edit-btn', function() {
        const id = parseInt($(this).data('id'));
        const product = productData.find(p => p.id === id);
        
        if (!product) return;

        $('#editId').val(product.id);
        $('#productName').val(product.name);
        $('#upperQty').val(product.upperQty);
        $('#lowerQty').val(product.lowerQty);
        updateTotalPairs();
        $('#productModalLabel').text('Edit Product');
        $('#productModal').modal('show');
    });

    // Delete button
    $(document).on('click', '.delete-btn', function() {
        const id = parseInt($(this).data('id'));
        const product = productData.find(p => p.id === id);
        
        if (!product) return;

        Swal.fire({
            title: 'Are you sure?',
            html: `You are about to delete <strong>${product.name}</strong>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                productData = productData.filter(p => p.id !== id);
                renderAll();
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Product has been deleted successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        });
    });

    // Complete button
    $(document).on('click', '.complete-btn', function() {
        const id = parseInt($(this).data('id'));
        const product = productData.find(p => p.id === id);
        
        if (!product) return;

        const pairs = calculatePairs(product.upperQty, product.lowerQty);
        
        $('#completeProductId').val(id);
        $('#completeProductName').text(product.name);
        $('#completeUpper').text(product.upperQty);
        $('#completeLower').text(product.lowerQty);
        $('#completePairs').text(pairs);

        $('#completeModal').modal('show');
    });

    // Confirm Complete
    $('#confirmCompleteBtn').click(function() {
        const id = parseInt($('#completeProductId').val());
        const product = productData.find(p => p.id === id);
        
        if (!product) return;

        product.status = 'complete';
        renderAll();
        $('#completeModal').modal('hide');

        const pairs = calculatePairs(product.upperQty, product.lowerQty);
        Swal.fire({
            icon: 'success',
            title: 'Product Complete!',
            text: `${product.name} - ${pairs} complete garments ready for stock!`,
            timer: 3000,
            showConfirmButton: false
        });
    });

    // Modal close handlers
    $('#productModal').on('hidden.bs.modal', function() {
        resetForm();
    });

    // Initial render
    renderAll();
});