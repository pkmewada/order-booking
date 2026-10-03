$(document).ready(function() {
    let currentCustomer = null;
    let orderItems = []; // { barcode, itemCode, size, brand, piecesPerSet, qty }
    let html5QrCode = null;
    let scanTarget = null; // 'customer' | 'product'
    let editingOrderId = null;

    // ---------- Data helpers ----------

    function getList(key) {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    }

    function getNameById(key, id) {
        const item = getList(key).find(i => i.id === id);
        return item ? item.name : 'N/A';
    }

    // Products are managed via the Product Creation page (localStorage
    // 'products'). Mirrors how a real product/barcode API response would
    // look once this is wired to a backend.
    function loadProducts() {
        return getList('products');
    }

    function findCustomerByCode(code) {
        const clean = (code || '').trim();
        if (!clean) return null;
        const id = clean.replace(/^ORDBK-CUST-/i, '');
        return getList('customers').find(c => c.id === id || c.id === clean) || null;
    }

    function findProductByCode(code) {
        const clean = (code || '').trim();
        if (!clean) return null;
        return loadProducts().find(p => p.barcode === clean || p.id === clean) || null;
    }

    // ---------- Step 1: Customer scan ----------

    function applyCustomer(customer) {
        currentCustomer = customer;

        $('#orgCustomerName').val(customer.name);
        $('#orgCustomerContact').val(customer.contact);
        $('#orgCustomerCity').val(customer.city);
        $('#orgCustomerShop').val(customer.shopName);
        $('#orgAgent').val(getNameById('agents', customer.agentId));
        $('#orgTransport').val(getNameById('transporters', customer.transporterId));
        $('#orgDistributor').val(getNameById('distributors', customer.distributorId));

        $('#organizeRow, #productRow, #submitRow').removeClass('d-none');
        $('#customerScanInput').val(buildCustomerLabel(customer));
        hideCustomerResults();
    }

    function buildCustomerLabel(customer) {
        return `${customer.name} (${customer.shopName})`;
    }

    function lookupCustomer(code) {
        let customer = findCustomerByCode(code);
        if (!customer) {
            const query = String(code || '').trim().toLowerCase();
            const matches = getList('customers').filter(c => String(c.name || '').toLowerCase() === query || buildCustomerLabel(c).toLowerCase() === query);
            if (matches.length === 1) customer = matches[0];
            else if (showCustomerResults(code)) return;
        }
        if (!customer) {
            Swal.fire('Not Found!', 'No customer matches this name or QR code. Please create the customer first in Customer Creation.', 'warning');
            return;
        }
        applyCustomer(customer);
        Swal.fire({ icon: 'success', title: 'Customer Found!', text: `${customer.name} - ${customer.shopName}`, timer: 1500, showConfirmButton: false });
    }

    function hideCustomerResults() {
        $('#customerSearchResults').empty().addClass('d-none');
        $('#customerScanInput').attr('aria-expanded', 'false');
    }
    function showCustomerResults(value) {
        const query = String(value || '').trim().toLowerCase();
        hideCustomerResults();
        if (!query) return false;
        const matches = getList('customers').filter(c => [c.name, c.shopName].some(v => String(v || '').toLowerCase().includes(query)));
        const list = $('#customerSearchResults');
        matches.forEach(c => {
            const button = $('<button>', {type:'button',class:'list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-3'}).attr('data-id', c.id);
            $('<span>', {class:'fw-medium'}).text(c.name || '').appendTo(button);
            $('<span>', {class:'text-muted small text-end'}).text(c.shopName || '').appendTo(button);
            button.appendTo(list);
        });
        if (!matches.length) $('<div>', {class:'list-group-item text-muted'}).text('No customers found.').appendTo(list);
        list.removeClass('d-none'); $('#customerScanInput').attr('aria-expanded', 'true');
        return matches.length > 0;
    }
    $('#customerScanInput').on('input', function () {
        if (currentCustomer && this.value !== buildCustomerLabel(currentCustomer)) currentCustomer = null;
        showCustomerResults(this.value);
    }).on('keydown', function (e) {
        if (e.key === 'Escape') hideCustomerResults();
        if (e.key === 'ArrowDown') { e.preventDefault(); $('#customerSearchResults button:first').trigger('focus'); }
    });
    $('#customerSearchResults').on('click', 'button', function () {
        const customer = getList('customers').find(c => String(c.id) === this.dataset.id);
        if (customer) applyCustomer(customer);
    }).on('keydown', 'button', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); $(this).next('button').trigger('focus'); }
        if (e.key === 'ArrowUp') { e.preventDefault(); const previous = $(this).prev('button'); if (previous.length) previous.trigger('focus'); else $('#customerScanInput').trigger('focus'); }
        if (e.key === 'Escape') { hideCustomerResults(); $('#customerScanInput').trigger('focus'); }
    });
    $(document).on('click', function (e) {
        if (!$(e.target).closest('#customerSearchResults, #customerScanInput, #customerFindBtn').length) hideCustomerResults();
    });
    $('#customerFindBtn').click(function() {
        lookupCustomer($('#customerScanInput').val());
    });

    $('#customerScanInput').keypress(function(e) {
        if (e.which === 13) {
            e.preventDefault();
            $('#customerFindBtn').click();
        }
    });

    $('#clearCustomerBtn').click(function() {
        resetOrderForm();
    });

    // ---------- Step 2: Product scan ----------

    function productDesign(product) {
        return String(product.designNumber || product.description || '');
    }

    function hideProductResults() {
        $('#productSearchResults').empty().addClass('d-none');
        $('#productScanInput').attr('aria-expanded', 'false');
    }

    function showProductResults(value) {
        const query = String(value || '').trim().toLowerCase();
        hideProductResults();
        const matches = loadProducts().filter(p => productDesign(p).toLowerCase().includes(query));
        const list = $('#productSearchResults');
        matches.forEach(product => {
            const button = $('<button>', {type: 'button', class: 'list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-3'});
            button.data('product', product);
            $('<span>', {class: 'fw-medium'}).text(productDesign(product)).appendTo(button);
            $('<span>', {class: 'text-muted small text-end'}).text([product.brand, product.color, product.size].filter(Boolean).join(' | ')).appendTo(button);
            button.appendTo(list);
        });
        if (!matches.length) $('<div>', {class: 'list-group-item text-muted'}).text('No designs found. Please add products in Product Creation.').appendTo(list);
        list.removeClass('d-none');
        $('#productScanInput').attr('aria-expanded', 'true');
        return matches.length > 0;
    }

    $('#productScanInput').on('input focus', function () {
        showProductResults(this.value);
    }).on('keydown', function (e) {
        if (e.key === 'Escape') hideProductResults();
        if (e.key === 'ArrowDown') { e.preventDefault(); $('#productSearchResults button:first').trigger('focus'); }
    });
    $('#productSearchResults').on('click', 'button', function () {
        addProduct($(this).data('product'));
    }).on('keydown', 'button', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); $(this).next('button').trigger('focus'); }
        if (e.key === 'ArrowUp') { e.preventDefault(); const previous = $(this).prev('button'); if (previous.length) previous.trigger('focus'); else $('#productScanInput').trigger('focus'); }
        if (e.key === 'Escape') { $('#productScanInput').trigger('focus'); hideProductResults(); }
    });
    $(document).on('click', function (e) {
        if (!$(e.target).closest('#productSearchResults, #productScanInput, #productFindBtn').length) hideProductResults();
    });

    function upsertOrderItem(product) {
        const existing = orderItems.find(i => i.barcode === product.barcode);
        if (existing) {
            existing.qty += 1;
        } else {
            orderItems.push({
                barcode: product.barcode,
                description: product.description,
                size: product.size,
                brand: product.brand,
                piecesPerSet: product.piecesPerSet || 1,
                qty: 1
            });
        }
        renderItemsTable();
    }

    function lookupProduct(code) {
        let product = findProductByCode(code);
        if (!product) {
            const query = String(code || '').trim().toLowerCase();
            const matches = loadProducts().filter(p => productDesign(p).trim().toLowerCase() === query);
            if (matches.length === 1) product = matches[0];
            else if (showProductResults(code)) return;
        }
        if (!product) {
            Swal.fire('Not Found!', 'No product matches this design number or barcode. Please add it in Product Creation first.', 'warning');
            return;
        }

        addProduct(product);
    }

    function addProduct(product) {
        $('#previewItemCode').text(productDesign(product));
        $('#previewBarcode').text(product.barcode);
        $('#previewSize').text(product.size);
        $('#previewBrand').text(product.brand);
        $('#productPreviewCard').removeClass('d-none');

        upsertOrderItem(product);
        $('#productScanInput').val('').focus();
        hideProductResults();
    }

    $('#productFindBtn').click(function() {
        lookupProduct($('#productScanInput').val());
    });

    $('#productScanInput').keypress(function(e) {
        if (e.which === 13) {
            e.preventDefault();
            $('#productFindBtn').click();
        }
    });

    function renderItemsTable() {
        const tbody = $('#orderItemsBody');
        tbody.empty();

        if (orderItems.length === 0) {
            tbody.append(`
                <tr id="noItemsRow">
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="bx bx-package fs-2 d-block mb-2"></i>
                        No products scanned yet
                    </td>
                </tr>
            `);
        } else {
            orderItems.forEach((item, index) => {
                tbody.append(`
                    <tr>
                        <td>${item.description}</td>
                        <td>
                            <div class="input-group input-group-sm">
                                <button class="btn btn-outline-secondary qty-decrease" type="button" data-index="${index}">-</button>
                                <input type="number" class="form-control text-center qty-input" min="1" value="${item.qty}" data-index="${index}">
                                <button class="btn btn-outline-secondary qty-increase" type="button" data-index="${index}">+</button>
                            </div>
                        </td>
                        <td>${item.size}</td>
                        <td>${item.barcode}</td>
                        <td>${item.brand}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-danger remove-item-btn" data-index="${index}">Remove</button>
                        </td>
                    </tr>
                `);
            });
        }

        const totalSets = orderItems.reduce((sum, i) => sum + i.qty, 0);
        const totalPcs = orderItems.reduce((sum, i) => sum + (i.qty * i.piecesPerSet), 0);
        $('#totalSets').text(`${totalSets} Set`);
        $('#totalPcs').text(`${totalPcs} Pcs`);

        $('.qty-decrease').click(function() {
            const index = $(this).data('index');
            if (orderItems[index].qty > 1) {
                orderItems[index].qty -= 1;
                renderItemsTable();
            }
        });

        $('.qty-increase').click(function() {
            const index = $(this).data('index');
            orderItems[index].qty += 1;
            renderItemsTable();
        });

        $('.qty-input').change(function() {
            const index = $(this).data('index');
            const val = parseInt($(this).val());
            orderItems[index].qty = (!val || val < 1) ? 1 : val;
            renderItemsTable();
        });

        $('.remove-item-btn').click(function() {
            const index = $(this).data('index');
            orderItems.splice(index, 1);
            renderItemsTable();
        });
    }

    // ---------- Camera scanning (shared for customer + product) ----------

    function stopCamera() {
        if (html5QrCode) {
            html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
        }
    }

    function startScanner(target) {
        scanTarget = target;
        $('#scannerModalLabel').text(target === 'customer' ? 'Scan Customer QR Code' : 'Scan Product QR Code');
        $('#scannerStatus').text('Requesting camera access...');
        $('#scannerModal').modal('show');

        if (typeof Html5Qrcode === 'undefined') {
            $('#scannerStatus').text('Camera scanner library failed to load. Please use manual entry instead.');
            return;
        }

        html5QrCode = new Html5Qrcode('scannerViewport');
        html5QrCode.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (decodedText) => {
                $('#scannerModal').modal('hide');
                stopCamera();
                if (scanTarget === 'customer') {
                    $('#customerScanInput').val(decodedText);
                    lookupCustomer(decodedText);
                } else {
                    $('#productScanInput').val(decodedText);
                    lookupProduct(decodedText);
                }
            },
            () => { /* ignore per-frame decode failures */ }
        ).then(() => {
            $('#scannerStatus').text('Point the camera at a QR code.');
        }).catch((err) => {
            $('#scannerStatus').text('Unable to access camera. Please use manual entry instead.');
        });
    }

    $('#customerCameraBtn').click(function() { startScanner('customer'); });
    $('#productCameraBtn').click(function() { startScanner('product'); });

    $('#scannerModal').on('hidden.bs.modal', function() {
        stopCamera();
    });

    // ---------- Submit ----------

    function resetOrderForm() {
        currentCustomer = null;
        orderItems = [];
        $('#customerScanInput').val('');
        hideCustomerResults();
        $('#productScanInput').val('');
        hideProductResults();
        $('#orgDeliveryDate').val('');
        $('#orgExistingCustomer').val('No');
        $('#productPreviewCard').addClass('d-none');
        $('#organizeRow, #productRow, #submitRow').addClass('d-none');
        renderItemsTable();
    }

    $('#submitOrderBtn').click(function() {
        if (!currentCustomer) {
            Swal.fire('Warning!', 'Please scan a customer before submitting.', 'warning');
            return;
        }
        const deliveryDate = $('#orgDeliveryDate').val();
        if (!deliveryDate) {
            Swal.fire('Warning!', 'Please select a delivery date.', 'warning');
            $('#orgDeliveryDate').focus();
            return;
        }
        if (orderItems.length === 0) {
            Swal.fire('Warning!', 'Please scan at least one product.', 'warning');
            return;
        }

        const totalSets = orderItems.reduce((sum, i) => sum + i.qty, 0);
        const totalPcs = orderItems.reduce((sum, i) => sum + (i.qty * i.piecesPerSet), 0);

        const orderFields = {
            customerId: currentCustomer.id,
            customerName: currentCustomer.name,
            shopName: currentCustomer.shopName,
            city: currentCustomer.city || '',
            contact: currentCustomer.contact || '',
            agentName: (getList('agents').find(agent => agent.id === currentCustomer.agentId) || {}).name || '',
            transportName: (getList('transporters').find(transport => transport.id === currentCustomer.transporterId) || {}).name || '',
            agentId: currentCustomer.agentId,
            transporterId: currentCustomer.transporterId,
            distributorId: currentCustomer.distributorId,
            existingCustomer: $('#orgExistingCustomer').val(),
            deliveryDate: deliveryDate,
            items: orderItems,
            totalSets: totalSets,
            totalPcs: totalPcs
        };

        const orders = getList('orders');

        if (editingOrderId) {
            const index = orders.findIndex(o => o.id === editingOrderId);
            if (index !== -1) {
                orders[index] = { ...orders[index], ...orderFields, updatedAt: new Date().toISOString() };
            }
            localStorage.setItem('orders', JSON.stringify(orders));
            Swal.fire('Order Updated!', 'The order has been updated successfully.', 'success').then(() => {
                window.location.href = 'order-list';
            });
            return;
        }

        orders.push({
            id: 'ORD' + Date.now(),
            status: 'Active',
            createdAt: new Date().toISOString(),
            ...orderFields
        });
        localStorage.setItem('orders', JSON.stringify(orders));

        Swal.fire('Order Saved!', 'The order has been submitted and saved successfully.', 'success');
        resetOrderForm();
    });

    // ---------- Init: edit mode ----------

    function loadOrderForEdit(orderId) {
        const orders = getList('orders');
        const order = orders.find(o => o.id === orderId);

        if (!order) {
            Swal.fire('Not Found!', 'This order could not be found. It may have been deleted.', 'warning').then(() => {
                window.location.href = 'order-list';
            });
            return;
        }

        editingOrderId = order.id;
        $('#pageTitle').text('Edit Order');
        $('#breadcrumbActive').text('Edit Order');
        $('#submitOrderBtn').html('<i class="bx bx-save me-1"></i> Update Order');
        $('#backToListBtn').removeClass('d-none');

        // Customer master data may have changed or been removed since the
        // order was placed; fall back to the snapshot stored on the order.
        const customer = getList('customers').find(c => c.id === order.customerId) || {
            id: order.customerId,
            name: order.customerName,
            shopName: order.shopName,
            contact: 'N/A',
            city: 'N/A',
            agentId: order.agentId,
            transporterId: order.transporterId,
            distributorId: order.distributorId
        };

        applyCustomer(customer);
        $('#orgExistingCustomer').val(order.existingCustomer);
        $('#orgDeliveryDate').val(order.deliveryDate);

        orderItems = JSON.parse(JSON.stringify(order.items));
        renderItemsTable();
    }

    // ---------- Init ----------
    renderItemsTable();

    const editId = new URLSearchParams(window.location.search).get('id');
    if (editId) {
        loadOrderForEdit(editId);
    }
});
