$(document).ready(function() {
    // Brand-Size mappings
    const BRAND_SIZES = {
        'NIVI BLOSSOM': '28-34',
        'AMARI': 'S-L',
        'LITTLE DOLLY': '18-26'
    };

    // Function to update size display based on brand
    function updateSizeDisplay(brand) {
        if (brand && BRAND_SIZES[brand]) {
            $('#sizeDisplay').val(BRAND_SIZES[brand]);
        } else {
            $('#sizeDisplay').val('');
        }
    }

    // Update size display when brand changes
    $('#brand').change(function() {
        const brand = $(this).val();
        updateSizeDisplay(brand);
    });

    // Load product data if editing
    const productId = $('#productId').val();
    if (productId) {
        const products = JSON.parse(localStorage.getItem('products') || '[]');
        const product = products.find(p => p.id === productId);
        if (product) {
            $('#description').val(product.description);
            $('#barcode').val(product.barcode);
            $('#brand').val(product.brand);
            updateSizeDisplay(product.brand);
        }
    } else {
        // For new product - set default brand and size
        const defaultBrand = 'NIVI BLOSSOM';
        $('#brand').val(defaultBrand);
        updateSizeDisplay(defaultBrand);
    }

    // Form submission
    $('#productForm').submit(function(e) {
        e.preventDefault();
        
        const description = $('#description').val().trim();
        const barcode = $('#barcode').val().trim();
        const brand = $('#brand').val();
        const size = $('#sizeDisplay').val();

        if (!description || !barcode || !brand || !size) {
            Swal.fire('Warning!', 'Please fill in all required fields.', 'warning');
            return;
        }

        // Get products from localStorage
        let products = JSON.parse(localStorage.getItem('products') || '[]');
        
        const productId = $('#productId').val();
        if (productId) {
            // Edit existing product
            const index = products.findIndex(p => p.id === productId);
            if (index !== -1) {
                products[index] = {
                    ...products[index],
                    description,
                    barcode,
                    brand,
                    size
                };
            }
        } else {
            // Add new product
            // Check duplicate barcode
            if (products.some(p => p.barcode.toLowerCase() === barcode.toLowerCase())) {
                Swal.fire('Warning!', 'Barcode already exists. Please use a unique barcode.', 'warning');
                return;
            }
            
            products.push({
                id: 'PRD' + Date.now() + Math.floor(Math.random() * 1000),
                description,
                barcode,
                brand,
                size,
                photo: null
            });
        }

        // Save to localStorage
        localStorage.setItem('products', JSON.stringify(products));
        
        Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: productId ? 'Product updated successfully.' : 'Product added successfully.',
            timer: 2000,
            showConfirmButton: true
        }).then(() => {
            window.location.href = 'product-creation';
        });
    });
});