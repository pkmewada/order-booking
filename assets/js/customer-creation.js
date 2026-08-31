$(document).ready(function() {
    let customers = [];
    let searchTerm = '';

    loadCustomers();

    function loadCustomers() {
        const stored = localStorage.getItem('customers');
        customers = stored ? JSON.parse(stored) : [];
        renderTable();
    }

    function saveToLocalStorage() {
        localStorage.setItem('customers', JSON.stringify(customers));
    }

    function getList(key) {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    }

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
                $select.append(`<option value="${item.id}">${item.name}</option>`);
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
                    <td>${cust.name}</td>
                    <td>${cust.shopName}</td>
                    <td>${cust.contact}</td>
                    <td>${cust.email}</td>
                    <td>${cust.city}</td>
                    <td>${cust.state}</td>
                    <td>${getNameById('agents', cust.agentId)}</td>
                    <td>${getNameById('transporters', cust.transporterId)}</td>
                    <td>${getNameById('distributors', cust.distributorId)}</td>
                    <td class="text-center">
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-info qr-btn" data-id="${cust.id}" title="QR Code">
                                <i class="bx bx-qr"></i>
                            </button>
                            <button class="btn btn-sm btn-primary edit-btn" data-id="${cust.id}" title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger delete-btn" data-id="${cust.id}" title="Delete">
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
            const message = `Hello ${cust.name}, here is your customer QR code for ${cust.shopName}. Please save the attached/downloaded QR image and keep it handy for order booking. Code: ${buildQrValue(cust.id)}`;
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
        });

        $('#qrEmailBtn').off('click').on('click', function() {
            const subject = `Your Customer QR Code - ${cust.shopName}`;
            const body = `Hello ${cust.name},\n\nHere is your customer QR code for ${cust.shopName}.\nCustomer Code: ${buildQrValue(cust.id)}\n\nPlease find the QR code image downloaded from the portal and keep it handy for order booking.\n\nThank you.`;
            window.location.href = `mailto:${cust.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
        }).then((result) => {
            if (result.isConfirmed) {
                customers = customers.filter(c => c.id !== id);
                saveToLocalStorage();
                renderTable();
                Swal.fire('Deleted!', 'Customer has been deleted successfully.', 'success');
            }
        });
    }

    $('#addCustomerBtn').click(function() {
        $('#customerModalLabel').text('Add Customer');
        $('#editId').val('');
        $('#customerForm')[0].reset();
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
        $('#customerCity').val(cust.city);
        $('#customerState').val(cust.state);
        $('#customerAgent').val(cust.agentId);
        $('#customerTransporter').val(cust.transporterId);
        $('#customerDistributor').val(cust.distributorId);
        $('#customerModal').modal('show');
    }

    $('#saveCustomerBtn').click(function() {
        const editId = $('#editId').val();
        const name = $('#customerName').val().trim();
        const shopName = $('#customerShopName').val().trim();
        const contact = $('#customerContact').val().trim();
        const email = $('#customerEmail').val().trim();
        const city = $('#customerCity').val().trim();
        const state = $('#customerState').val().trim();
        const agentId = $('#customerAgent').val();
        const transporterId = $('#customerTransporter').val();
        const distributorId = $('#customerDistributor').val();

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
        if (!contact) {
            Swal.fire('Warning!', 'Please enter contact number', 'warning');
            $('#customerContact').focus();
            return;
        }
        if (!email) {
            Swal.fire('Warning!', 'Please enter email', 'warning');
            $('#customerEmail').focus();
            return;
        }
        if (!city) {
            Swal.fire('Warning!', 'Please enter city', 'warning');
            $('#customerCity').focus();
            return;
        }
        if (!state) {
            Swal.fire('Warning!', 'Please enter state', 'warning');
            $('#customerState').focus();
            return;
        }
        if (!agentId) {
            Swal.fire('Warning!', 'Please select an agent', 'warning');
            $('#customerAgent').focus();
            return;
        }
        if (!transporterId) {
            Swal.fire('Warning!', 'Please select a transporter', 'warning');
            $('#customerTransporter').focus();
            return;
        }
        if (!distributorId) {
            Swal.fire('Warning!', 'Please select a distributor', 'warning');
            $('#customerDistributor').focus();
            return;
        }

        if (editId) {
            const index = customers.findIndex(c => c.id === editId);
            if (index !== -1) {
                customers[index] = { ...customers[index], name, shopName, contact, email, city, state, agentId, transporterId, distributorId };
                Swal.fire('Success!', 'Customer updated successfully!', 'success');
            }
        } else {
            customers.push({ id: 'CUS' + Date.now(), name, shopName, contact, email, city, state, agentId, transporterId, distributorId });
            Swal.fire('Success!', 'Customer added successfully!', 'success');
        }

        saveToLocalStorage();
        renderTable();
        $('#customerModal').modal('hide');
        $('#customerForm')[0].reset();
    });

    $('#searchInput').on('keyup', function() {
        searchTerm = $(this).val();
        renderTable();
    });

    $('#customerModal').on('hidden.bs.modal', function() {
        $('#customerForm')[0].reset();
        $('#editId').val('');
    });
});
