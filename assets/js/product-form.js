$(function () {
    const read = key => {
        try { const rows = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(rows) ? rows : []; }
        catch (_) { return []; }
    };
    const norm = value => String(value || '').trim().toLowerCase();
    const id = $('#productId').val();
    const original = read('products').find(p => String(p.id) === id);
    function updateSize() {
        const size = ProductCodes.sizes[$('#brand').val()] || '';
        $('#brandSizeHint').text(size ? 'Size: ' + size : 'Size will be selected automatically from the brand.');
    }
    if (original) {
        $('#productDesign').val(original.designNumber || original.description || '');
        $('#color').val(original.color || '');
        $('#brand').val(String(original.brand || '').trim().toUpperCase());
    }
    $('#brand').on('change', updateSize);
    updateSize();
    $('#productForm').on('submit', function (e) {
        e.preventDefault();
        const designNumber = $('#productDesign').val().trim();
        const color = $('#color').val().trim();
        const brand = $('#brand').val();
        const size = ProductCodes.sizes[brand] || '';
        const barcode = ProductCodes.generate(brand, designNumber, color, size);
        if (!designNumber || !color || !brand || !size || !barcode) {
            Swal.fire('Warning!', 'Enter design number, colour and brand.', 'warning'); return;
        }
        const products = read('products');
        if (products.some(p => String(p.id) !== id && norm(p.barcode) === norm(barcode))) {
            Swal.fire('Warning!', 'This product already exists.', 'warning'); return;
        }
        const design = norm(designNumber);
        if (products.some(p => String(p.id) !== id && norm(p.designNumber || p.description) === design)) {
            Swal.fire('Warning!', 'Design number already exists in Product Creation. Use a unique design number.', 'warning'); return;
        }
        const unchangedDesign = original && norm(original.designNumber || original.description) === design;
        if (!unchangedDesign && read('bomMasterData').some(b => norm(b.designNumber) === design)) {
            Swal.fire('Warning!', 'Design number already exists in BOM Master. Use a different design number.', 'warning'); return;
        }
        const details = original || {};
        const product = {
            ...details,
            id: id || 'PRD' + Date.now() + '-' + Math.floor(Math.random() * 10000),
            bomId: original && norm(original.designNumber || original.description) === design ? original.bomId ?? null : null,
            sourceDesignNumber: original && norm(original.designNumber || original.description) === design ? original.sourceDesignNumber || '' : '',
            designNumber, description: designNumber, color, brand, size, barcode,
            pieces: details.pieces || [],
            pieceCount: details.pieceCount || details.pieces?.length || 1,
            photo: details.photo || null
        };
        if (id) {
            const index = products.findIndex(p => String(p.id) === id);
            if (index < 0) { Swal.fire('Error!', 'Product no longer exists.', 'error'); return; }
            products[index] = product;
        } else { products.push(product); }
        try { localStorage.setItem('products', JSON.stringify(products)); }
        catch (_) { Swal.fire('Error!', 'Browser storage is full. Product could not be saved.', 'error'); return; }
        Swal.fire('Success!', 'Product saved successfully.', 'success').then(() => { window.location.href = 'product-creation'; });
    });
});
