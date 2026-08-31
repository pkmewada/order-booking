$(document).ready(function() {
    const BRAND_SIZES = {
        'NIVI BLOSSOM': ['28', '30', '32', '34'],
        'AMARI': ['S', 'M', 'L'],
        'LITTLE DOLLY': ['18', '20', '22', '24', '26']
    };

    function populateSizes(brand, selectedSize) {
        const $size = $('#productSize');
        $size.empty().append('<option value="">Select Size</option>');
        const sizes = BRAND_SIZES[brand] || [];
        sizes.forEach(size => {
            $size.append(`<option value="${size}">${size}</option>`);
        });
        $size.prop('disabled', sizes.length === 0);
        if (selectedSize) {
            $size.val(selectedSize);
        }
    }

    $('#productBrand').change(function() {
        populateSizes($(this).val());
    });

    function getProducts() {
        const stored = localStorage.getItem('products');
        return stored ? JSON.parse(stored) : [];
    }

    function saveProducts(products) {
        localStorage.setItem('products', JSON.stringify(products));
    }

    const editId = new URLSearchParams(window.location.search).get('id');
    let editingProduct = null;

    if (editId) {
        editingProduct = getProducts().find(p => p.id === editId) || null;

        if (editingProduct) {
            $('#formTitle').text('Edit Product');
            $('#formBreadcrumb').text('Edit Product');
            $('#productId').val(editingProduct.id);
            $('#itemDescription').val(editingProduct.description);
            $('#barcodeNo').val(editingProduct.barcode);
            $('#productBrand').val(editingProduct.brand);
            populateSizes(editingProduct.brand, editingProduct.size);
        } else {
            Swal.fire('Not Found!', 'This product could not be found. It may have been deleted.', 'warning');
        }
    }

    $('#saveProductBtn').click(function() {
        const id = $('#productId').val();
        const description = $('#itemDescription').val().trim();
        const barcode = $('#barcodeNo').val().trim();
        const size = $('#productSize').val();
        const brand = $('#productBrand').val();

        if (!description) {
            Swal.fire('Warning!', 'Please enter item description', 'warning');
            $('#itemDescription').focus();
            return;
        }
        if (!barcode) {
            Swal.fire('Warning!', 'Please enter barcode no', 'warning');
            $('#barcodeNo').focus();
            return;
        }
        if (!size) {
            Swal.fire('Warning!', 'Please select a size', 'warning');
            $('#productSize').focus();
            return;
        }
        if (!brand) {
            Swal.fire('Warning!', 'Please select a brand', 'warning');
            $('#productBrand').focus();
            return;
        }

        const products = getProducts();
        const duplicate = products.some(p => p.barcode.toLowerCase() === barcode.toLowerCase() && p.id !== id);
        if (duplicate) {
            Swal.fire('Warning!', 'A product with this barcode already exists', 'warning');
            return;
        }

        if (id) {
            const index = products.findIndex(p => p.id === id);
            if (index !== -1) {
                products[index] = { ...products[index], description, barcode, size, brand };
            }
        } else {
            products.push({ id: 'PRD' + Date.now(), description, barcode, size, brand });
        }

        saveProducts(products);

        Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: id ? 'Product updated successfully!' : 'Product added successfully!',
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            window.location.href = 'product-creation';
        });
    });
});
