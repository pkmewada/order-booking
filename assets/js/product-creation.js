$(document).ready(function() {
    let products = [];
    let searchTerm = '';

    const TEMPLATE_HEADERS = ['Item Description', 'Barcode No', 'Size', 'Brand'];

    loadProducts();

    function loadProducts() {
        const stored = localStorage.getItem('products');
        products = stored ? JSON.parse(stored) : [];
        renderTable();
    }

    function saveToLocalStorage() {
        localStorage.setItem('products', JSON.stringify(products));
    }

    function renderTable() {
        const tbody = $('#productTableBody');
        tbody.empty();

        let filtered = products;
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(p =>
                p.description.toLowerCase().includes(term) ||
                p.barcode.toLowerCase().includes(term)
            );
        }

        if (filtered.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="bx bx-package fs-2 d-block mb-2"></i>
                        No products found
                    </td>
                </tr>
            `);
            return;
        }

        filtered.forEach((prod, index) => {
            const photoCell = prod.photo
                ? `<img src="${prod.photo}" alt="photo" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">`
                : `<input type="file" accept="image/*" class="form-control form-control-sm photo-upload-input" data-id="${prod.id}" style="max-width:150px;">`;

            tbody.append(`
                <tr>
                    <td>${photoCell}</td>
                    <td>${index + 1}</td>
                    <td>${prod.description}</td>
                    <td>${prod.barcode}</td>
                    <td>${prod.size}</td>
                    <td>${prod.brand}</td>
                    <td class="text-center">
                        <div class="btn-group" role="group">
                            <a href="product-form?id=${prod.id}" class="btn btn-sm btn-primary" title="Edit">
                                <i class="bx bx-edit"></i>
                            </a>
                            <button class="btn btn-sm btn-danger delete-btn" data-id="${prod.id}" title="Delete">
                                <i class="bx bx-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `);
        });

        $('.delete-btn').click(function() {
            showDeleteConfirmation($(this).data('id'));
        });

        $('.photo-upload-input').change(function() {
            const id = $(this).data('id');
            const file = this.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                const index = products.findIndex(p => p.id === id);
                if (index !== -1) {
                    products[index].photo = e.target.result;
                    saveToLocalStorage();
                    renderTable();
                }
            };
            reader.readAsDataURL(file);
        });
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
                products = products.filter(p => p.id !== id);
                saveToLocalStorage();
                renderTable();
                Swal.fire('Deleted!', 'Product has been deleted successfully.', 'success');
            }
        });
    }

    $('#searchInput').on('keyup', function() {
        searchTerm = $(this).val();
        renderTable();
    });

    // ---------- Import ----------

    $('#importProductBtn').click(function() {
        $('#importFileInput').val('');
        $('#importFileHint').text('');
        $('#importModal').modal('show');
    });

    $('#downloadTemplateBtn').click(function() {
        const sampleRows = [
            TEMPLATE_HEADERS,
            ['NB6011-RANI', 'LD51347', '28-34', 'NIVI BLOSSOM'],
            ['40225-PINK', 'LD51925', '18-26', 'LITTLE DOLLY']
        ];
        const worksheet = XLSX.utils.aoa_to_sheet(sampleRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
        XLSX.writeFile(workbook, 'product-import-template.xlsx');
    });

    $('#uploadImportBtn').click(function() {
        const file = $('#importFileInput')[0].files[0];
        if (!file) {
            Swal.fire('Warning!', 'Please choose a file to upload.', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            let rows;
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
            } catch (err) {
                Swal.fire('Error!', 'Could not read this file. Please upload a valid Excel/CSV file.', 'error');
                return;
            }

            importRows(rows);
        };
        reader.onerror = function() {
            Swal.fire('Error!', 'Failed to read the file.', 'error');
        };
        reader.readAsArrayBuffer(file);
    });

    function importRows(rows) {
        if (!rows || rows.length < 2) {
            Swal.fire('Warning!', 'The file has no data rows.', 'warning');
            return;
        }

        // Skip header row
        const dataRows = rows.slice(1);
        const existingBarcodes = new Set(products.map(p => p.barcode.toLowerCase()));

        let imported = 0;
        let skipped = 0;

        dataRows.forEach(row => {
            const description = (row[0] || '').toString().trim();
            const barcode = (row[1] || '').toString().trim();
            const size = (row[2] || '').toString().trim();
            const brand = (row[3] || '').toString().trim();

            if (!description || !barcode || !size || !brand) {
                skipped++;
                return;
            }
            if (existingBarcodes.has(barcode.toLowerCase())) {
                skipped++;
                return;
            }

            products.push({
                id: 'PRD' + Date.now() + Math.floor(Math.random() * 1000),
                description, barcode, size, brand
            });
            existingBarcodes.add(barcode.toLowerCase());
            imported++;
        });

        saveToLocalStorage();
        renderTable();
        $('#importModal').modal('hide');

        Swal.fire('Import Complete', `${imported} product(s) imported, ${skipped} skipped (missing fields or duplicate barcode).`, imported > 0 ? 'success' : 'warning');
    }
});
