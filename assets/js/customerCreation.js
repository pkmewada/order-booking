$(document).ready(function() {
    let customers = [];
    let searchTerm = '';
    const stateCity = StateCity.init(document.getElementById('customerState'), document.getElementById('customerCity'));



    const masters = { agents: [], transporters: [], distributors: [] };
    async function request(endpoint, method = 'GET', data) {
        const response = await fetch('api/' + endpoint + '.php', {
            method, headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
            body: data ? JSON.stringify(data) : undefined
        });
        let result;
        try { result = await response.json(); }
        catch (_) { throw new Error('Invalid server response. Check Apache and database setup.'); }
        if (!response.ok || !result.success) throw new Error(result.message || 'Unable to complete request.');
        return result.data;
    }
    function escapeHtml(value) { return $('<div>').text(value == null ? '' : String(value)).html(); }
    function saveToLocalStorage() {
        // Compatibility cache for existing order punch/QR lookup; database is authoritative.
        try {
            localStorage.setItem('customers', JSON.stringify(customers));
            for (const key of Object.keys(masters)) localStorage.setItem(key, JSON.stringify(masters[key]));
        } catch (error) { console.warn('Customer compatibility cache unavailable', error); }
    }
    async function loadCustomers() {
        $('#addCustomerBtn, #saveCustomerBtn').prop('disabled', true);
        $('#customerTableBody').html('<tr><td colspan="11" class="text-center py-4">Loading...</td></tr>');
        try {
            const [rows, agents, transporters, distributors] = await Promise.all([
                request('customer'), request('agent'), request('transporter'), request('distributor')
            ]);
            customers = rows;
            Object.assign(masters, { agents, transporters, distributors });
            saveToLocalStorage();
            populateAllSelects();
            renderTable();
            $('#addCustomerBtn, #saveCustomerBtn').prop('disabled', false);
        } catch (error) {
            $('#customerTableBody').html('<tr><td colspan="11" class="text-center py-4">Unable to load records. Refresh after checking database setup.</td></tr>');
            Swal.fire('Unable to load', error.message, 'error');
        }
    }
    loadCustomers();

    function getList(key) { return masters[key] || []; }

    function getNameById(key, id) {
        const item = getList(key).find(i => i.id === id);
        return item ? item.name : 'N/A';
    }

    function populateSelect(selectId, key) {
        const list = getList(key);
        const $select = $(selectId);
        const currentVal = $select.val();
        $select.find('option:not(:first)').remove();

        if (list.length === 0) {
            $select.append(`<option value="" disabled>No records found</option>`);
        } else {
            list.forEach(item => {
                $select.append($('<option>').val(item.id).text(item.name));
            });
        }
        $select.val(currentVal || '');
    }

    function populateAllSelects() {
        populateSelect('#customerAgent', 'agents');
        populateSelect('#customerTransporter', 'transporters');
        populateSelect('#customerDistributor', 'distributors');
    }

    function renderTable() {
        const tbody = $('#customerTableBody');
        tbody.empty();

        let filtered = customers;
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(c => c.name.toLowerCase().includes(term));
        }

        if (filtered.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="11" class="text-center text-muted py-4">
                        <i class="bx bx-user-x fs-2 d-block mb-2"></i>
                        No customers found
                    </td>
                </tr>
            `);
            return;
        }

        filtered.forEach((cust, index) => {
            tbody.append(`
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(cust.name)}</td>
                    <td>${escapeHtml(cust.shopName)}</td>
                    <td>${escapeHtml(cust.contact)}</td>
                    <td>${escapeHtml(cust.email)}</td>
                    <td>${escapeHtml(cust.city)}</td>
                    <td>${escapeHtml(cust.state)}</td>
                    <td>${escapeHtml(getNameById('agents', cust.agentId))}</td>
                    <td>${escapeHtml(getNameById('transporters', cust.transporterId))}</td>
                    <td>${escapeHtml(getNameById('distributors', cust.distributorId))}</td>
                    <td class="text-center">
                        <div class="d-inline-flex gap-2" role="group">
                            <button class="btn btn-sm btn-dark qr-btn" data-id="${cust.id}" title="QR Code">
                                <i class="bx bx-qr"></i>
                            </button>
                            <button class="btn btn-sm btn-primary edit-btn" data-id="${cust.id}" title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-dark delete-btn" data-id="${cust.id}" title="Delete">
                                <i class="bx bx-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `);
        });

        $('.qr-btn').click(function() {
            openQrModal($(this).data('id'));
        });

        $('.edit-btn').click(function() {
            openEditModal($(this).data('id'));
        });

        $('.delete-btn').click(function() {
            showDeleteConfirmation($(this).data('id'));
        });
    }

    // QR code value format: ORDBK-CUST-<id>. Order Punch scans this back to
    // look up the full customer record, mirroring how a real backend lookup
    // by ID would work once this is wired to a real API.
    function buildQrValue(customerId) {
        return 'ORDBK-CUST-' + customerId;
    }

    function normalizePhoneForWhatsapp(contact) {
        const digits = (contact || '').replace(/\D/g, '');
        return digits.length === 10 ? '91' + digits : digits;
    }

    function openQrModal(id) {
        const cust = customers.find(c => c.id === id);
        if (!cust) return;

        $('#qrCustomerName').text(cust.name);
        $('#qrCustomerShop').text(cust.shopName);

        const container = document.getElementById('qrCodeContainer');
        container.innerHTML = '';
        new QRCode(container, {
            text: buildQrValue(cust.id),
            width: 200,
            height: 200
        });

        $('#qrDownloadBtn').off('click').on('click', function() {
            const canvas = container.querySelector('canvas');
            const img = container.querySelector('img');
            const dataUrl = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
            if (!dataUrl) return;

            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `customer-qr-${cust.name.replace(/\s+/g, '-')}.png`;
            link.click();
        });

        $('#qrWhatsappBtn').off('click').on('click', function() {
            const phone = normalizePhoneForWhatsapp(cust.contact);
            const message = `Hello ${escapeHtml(cust.name)}, here is your customer QR code for ${escapeHtml(cust.shopName)}. Please save the attached/downloaded QR image and keep it handy for order booking. Code: ${buildQrValue(cust.id)}`;
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
        });

        $('#qrEmailBtn').prop('disabled', !cust.email);
        $('#qrEmailBtn').off('click').on('click', function() {
            const subject = `Your Customer QR Code - ${escapeHtml(cust.shopName)}`;
            const body = `Hello ${escapeHtml(cust.name)},\n\nHere is your customer QR code for ${escapeHtml(cust.shopName)}.\nCustomer Code: ${buildQrValue(cust.id)}\n\nPlease find the QR code image downloaded from the portal and keep it handy for order booking.\n\nThank you.`;
            window.location.href = `mailto:${escapeHtml(cust.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        });

        $('#qrModal').modal('show');
    }

    function showDeleteConfirmation(id) {
        Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await request('customer', 'DELETE', { id });
                    customers = customers.filter(c => c.id !== id);
                    saveToLocalStorage(); renderTable();
                    Swal.fire('Deleted!', 'Customer has been deleted successfully.', 'success');
                } catch (error) { Swal.fire('Unable to delete', error.message, 'error'); }
            }
        });
    }

    $('#addCustomerBtn').click(function() {
        $('#customerModalLabel').text('Add Customer');
        $('#editId').val('');
        $('#customerForm')[0].reset();
        stateCity.reset();
        populateAllSelects();
        $('#customerModal').modal('show');
    });

    function openEditModal(id) {
        const cust = customers.find(c => c.id === id);
        if (!cust) return;

        $('#customerModalLabel').text('Edit Customer');
        populateAllSelects();
        $('#editId').val(cust.id);
        $('#customerName').val(cust.name);
        $('#customerShopName').val(cust.shopName);
        $('#customerContact').val(cust.contact);
        $('#customerEmail').val(cust.email);
        stateCity.setValue(cust.state, cust.city);
        $('#customerAgent').val(cust.agentId || '');
        $('#customerTransporter').val(cust.transporterId || '');
        $('#customerDistributor').val(cust.distributorId || '');
        $('#customerModal').modal('show');
    }

    $('#saveCustomerBtn').click(async function() {
        const editId = $('#editId').val();
        const name = $('#customerName').val().trim();
        const shopName = $('#customerShopName').val().trim();
        const contact = $('#customerContact').val().trim();
        const email = $('#customerEmail').val().trim();
        const city = ($('#customerCity').val() || '').trim();
        const state = ($('#customerState').val() || '').trim();
        const agentId = $('#customerAgent').val() || '';
        const transporterId = $('#customerTransporter').val() || '';
        const distributorId = $('#customerDistributor').val() || '';

        if (!name) {
            Swal.fire('Warning!', 'Please enter name', 'warning');
            $('#customerName').focus();
            return;
        }
        if (!shopName) {
            Swal.fire('Warning!', 'Please enter shop name', 'warning');
            $('#customerShopName').focus();
            return;
        }
        if (!/^[6-9][0-9]{9}$/.test(contact)) {
            Swal.fire('Warning!', 'Phone number must be 10 digits and start with 6, 7, 8 or 9.', 'warning');
            $('#customerContact').focus(); return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            Swal.fire('Warning!', 'Please enter a valid email address.', 'warning');
            $('#customerEmail').focus(); return;
        }
        const button = $(this);
        if (button.prop('disabled')) return;
        button.prop('disabled', true);
        try {
            const record = await request('customer', editId ? 'PUT' : 'POST', {
                id: editId, name, shopName, contact, email, city, state, agentId, transporterId, distributorId
            });
            if (editId) {
                const index = customers.findIndex(c => c.id === editId);
                if (index !== -1) customers[index] = record;
            } else { customers.unshift(record); }
            saveToLocalStorage(); renderTable();
            $('#customerModal').modal('hide');
            $('#customerForm')[0].reset();
            Swal.fire('Success!', 'Customer ' + (editId ? 'updated' : 'added') + ' successfully!', 'success');
        } catch (error) { Swal.fire('Unable to save', error.message, 'error'); }
        finally { button.prop('disabled', false); }
    });

    $('#searchInput').on('keyup', function() {
        searchTerm = $(this).val();
        renderTable();
    });

    $('#customerModal').on('hidden.bs.modal', function() {
        $('#customerForm')[0].reset();
        stateCity.reset();
        $('#editId').val('');
    });
});
